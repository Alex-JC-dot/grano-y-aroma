-- =====================================================================
-- Grano y Aroma · 013b · Canje de puntos por descuento (RF-32)
-- =====================================================================
-- Hasta ahora los puntos solo subían. El cliente veía "Sumaste 12 puntos" en Mi cuenta y no
-- podía hacer nada con ellos, que es justo la mitad que faltaba del requisito: el RF-32 pide
-- puntos "canjeables por descuentos futuros".
--
-- Qué agrega:
--   1. El cliente aplica puntos al pagar y el total baja.
--   2. Un historial de movimientos: cuánto sumó cada compra, cuánto se canjeó y en qué pedido.
--      Sin historial, un saldo es un número sin respaldo y nadie puede reclamar una diferencia.
--   3. Si el pedido se cancela, los puntos canjeados vuelven y los ganados se descuentan.
--
-- Las reglas de conversión viven en la base, no en el navegador:
--   · Se gana 1 punto por cada Bs. 10 pagados (como antes, pero sobre lo efectivamente
--     pagado: si no, canjear puntos generaría puntos sobre el descuento).
--   · Se canjea 1 punto = Bs. 1.
--   · El descuento no puede pasar del 50 % del pedido. Sin tope, un cliente con saldo alto
--     llevaría café gratis, y el negocio dejaría de cobrar envíos y costos.
--
-- Aditiva: no borra nada. Reemplaza cancelar_pedido() de la 009 conservando lo que hacía. El
-- confirmar_pedido() con canje quedó en la 015, junto con el tótem: si estuviera también aquí,
-- repetir esta migración borraría los turnos del tótem. Ejecutar DESPUÉS de la 012. Se puede repetir.

-- ---------- 1. Reglas, en un solo lugar ----------
create or replace function public.puntos_por_bs(p_monto numeric)
returns integer language sql immutable set search_path = public
as $$ select greatest(0, floor(coalesce(p_monto, 0) / 10)::int) $$;

create or replace function public.bs_por_puntos(p_puntos integer)
returns numeric language sql immutable set search_path = public
as $$ select greatest(0, coalesce(p_puntos, 0))::numeric $$;

/** Cuántos puntos se pueden aplicar a un pedido: lo que el cliente tiene, lo que pide y el tope. */
create or replace function public.puntos_aplicables(p_cliente uuid, p_total numeric, p_pedidos integer)
returns integer language sql stable set search_path = public
as $$
  select least(
    greatest(0, coalesce(p_pedidos, 0)),
    coalesce((select puntos from perfiles where id = p_cliente), 0),
    floor(coalesce(p_total, 0) * 0.5)::int          -- tope: la mitad del pedido
  );
$$;

-- ---------- 2. Historial de movimientos ----------
create table if not exists public.movimientos_puntos (
  id          bigint generated always as identity primary key,
  cliente_id  uuid not null references public.perfiles(id) on delete cascade,
  pedido_id   bigint references public.pedidos(id) on delete set null,
  puntos      integer not null,                 -- positivo suma, negativo canjea
  motivo      text not null,
  creado_en   timestamptz not null default now()
);
create index if not exists movimientos_puntos_cliente_idx
  on public.movimientos_puntos (cliente_id, creado_en desc);

alter table public.movimientos_puntos enable row level security;
drop policy if exists "cliente ve sus movimientos" on public.movimientos_puntos;
create policy "cliente ve sus movimientos" on public.movimientos_puntos for select
  using (cliente_id = auth.uid() or public.es_equipo());

-- Solo lectura, y solo la que la política deja pasar. Nadie escribe aquí a mano: los
-- movimientos los crean confirmar_pedido() y cancelar_pedido(), que son security definer.
grant select on public.movimientos_puntos to authenticated;

-- ---------- 3. Columnas del descuento ----------
alter table public.pedidos add column if not exists puntos_usados integer not null default 0;
alter table public.pedidos add column if not exists descuento numeric(10,2) not null default 0;
alter table public.pedidos add column if not exists puntos_ganados integer not null default 0;

-- ---------- 4. Confirmar el pedido con canje: ver la 015 ----------

-- ---------- 5. Cancelar: deshacer el canje ----------
-- Igual que en la 009 (devuelve el stock), pero ahora devolviendo también los puntos
-- canjeados y quitando los que esa compra había otorgado. La 009 restaba floor(total/10),
-- que con descuento ya no es la cifra correcta: ahora se usa lo que el pedido registró.
create or replace function public.cancelar_pedido(p_pedido bigint)
returns void language plpgsql security definer set search_path = public
as $$
declare p public.pedidos;
begin
  select * into p from pedidos where id = p_pedido for update;
  if not found then raise exception 'No encontramos ese pedido'; end if;
  if not (p.cliente_id = auth.uid() or public.es_equipo()) then raise exception 'No puedes cancelar este pedido'; end if;
  if p.estado <> 'recibido' then raise exception 'El pedido ya está en preparación y no se puede cancelar'; end if;

  update productos pr set stock = pr.stock + i.cantidad
    from pedido_items i where i.pedido_id = p.id and pr.id = i.producto_id;

  if p.cliente_id is not null and p.canal = 'web' then
    -- Devuelve lo canjeado y quita lo ganado, sin dejar el saldo en negativo.
    update perfiles
       set puntos = greatest(0, puntos + coalesce(p.puntos_usados, 0) - coalesce(p.puntos_ganados, 0))
     where id = p.cliente_id;

    if coalesce(p.puntos_usados, 0) > 0 then
      insert into movimientos_puntos (cliente_id, pedido_id, puntos, motivo)
      values (p.cliente_id, p.id, p.puntos_usados, 'Devolución por cancelar ' || p.codigo);
    end if;
    if coalesce(p.puntos_ganados, 0) > 0 then
      insert into movimientos_puntos (cliente_id, pedido_id, puntos, motivo)
      values (p.cliente_id, p.id, -p.puntos_ganados, 'Anulación de puntos por cancelar ' || p.codigo);
    end if;
  end if;

  update pedidos set estado = 'cancelado' where id = p.id;
end;
$$;
