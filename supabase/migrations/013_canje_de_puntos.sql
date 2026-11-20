-- =====================================================================
-- Grano y Aroma · 013 · Canje de puntos por descuento (RF-32)
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
-- Aditiva: no borra nada. Reemplaza confirmar_pedido() de la 002 y cancelar_pedido() de la
-- 009 conservando todo lo que hacían. Ejecutar DESPUÉS de la 012. Se puede repetir.

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

-- ---------- 4. Confirmar el pedido, ahora con canje ----------
-- Misma función de la 002 (bloqueo de stock incluido) más el canje. El total guardado es el
-- que el cliente paga: así los comprobantes, los reportes y el cierre de caja cuadran solos
-- sin tener que restar el descuento en cada consulta.
create or replace function public.confirmar_pedido(
  items jsonb, p_canal public.canal default 'web', p_metodo text default 'qr',
  p_nombre text default null, p_telefono text default null, p_direccion text default null,
  p_referencia text default null, p_puntos integer default 0
) returns public.pedidos
language plpgsql security definer set search_path = public
as $$
declare
  it jsonb; prod public.productos; nuevo public.pedidos;
  suma numeric := 0; usa int := 0; rebaja numeric := 0; gana int := 0;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  if p_canal = 'caja' and not public.es_equipo() then raise exception 'Solo el equipo registra ventas de caja'; end if;

  insert into pedidos (cliente_id, canal, metodo_pago, nombre, telefono, direccion, referencia)
  values (case when p_canal = 'caja' then null else auth.uid() end, p_canal, p_metodo, p_nombre, p_telefono, p_direccion, p_referencia)
  returning * into nuevo;

  for it in select * from jsonb_array_elements(items) loop
    select * into prod from productos where id = it ->> 'producto_id' and activo for update;   -- bloquea el stock
    if not found then raise exception 'Producto % no disponible', it ->> 'producto_id'; end if;
    if prod.stock < (it ->> 'cantidad')::int then
      raise exception 'Solo quedan % de %', prod.stock, prod.nombre;
    end if;
    update productos set stock = stock - (it ->> 'cantidad')::int where id = prod.id;
    insert into pedido_items values (nuevo.id, prod.id, (it ->> 'cantidad')::int, coalesce(it ->> 'molienda', 'Única'), prod.precio);
    suma := suma + prod.precio * (it ->> 'cantidad')::int;
  end loop;

  -- El canje se recalcula aquí aunque el navegador ya lo haya mostrado: lo que llega del
  -- cliente es una intención, no un dato de confianza.
  if nuevo.cliente_id is not null and coalesce(p_puntos, 0) > 0 then
    -- Bloquea el perfil: dos pedidos a la vez no pueden gastar el mismo saldo.
    perform 1 from perfiles where id = nuevo.cliente_id for update;
    usa := public.puntos_aplicables(nuevo.cliente_id, suma, p_puntos);
    rebaja := public.bs_por_puntos(usa);
  end if;

  gana := case when nuevo.cliente_id is null then 0 else public.puntos_por_bs(suma - rebaja) end;

  update pedidos
     set total = suma - rebaja, descuento = rebaja, puntos_usados = usa, puntos_ganados = gana
   where id = nuevo.id
  returning * into nuevo;

  if nuevo.cliente_id is not null then
    update perfiles set puntos = puntos - usa + gana where id = nuevo.cliente_id;
    if usa > 0 then
      insert into movimientos_puntos (cliente_id, pedido_id, puntos, motivo)
      values (nuevo.cliente_id, nuevo.id, -usa, 'Canje en el pedido ' || nuevo.codigo);
    end if;
    if gana > 0 then
      insert into movimientos_puntos (cliente_id, pedido_id, puntos, motivo)
      values (nuevo.cliente_id, nuevo.id, gana, 'Compra ' || nuevo.codigo);
    end if;
  end if;

  return nuevo;
end;
$$;

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

revoke all on function public.confirmar_pedido(jsonb, public.canal, text, text, text, text, text, integer) from public, anon;
grant execute on function public.confirmar_pedido(jsonb, public.canal, text, text, text, text, text, integer) to authenticated;

-- La versión de 7 argumentos de la 002 queda obsoleta: si no se quita, PostgreSQL no sabe
-- cuál llamar cuando el frontend manda siete.
drop function if exists public.confirmar_pedido(jsonb, public.canal, text, text, text, text, text);
