-- =====================================================================
-- Grano y Aroma · 024 · Lo que no se paga no cuenta
-- =====================================================================
-- Al confirmar una compra por QR, el pedido nacía sin pagar pero ya daba los puntos y apartaba el
-- stock para siempre. Y si el cliente cerraba el carrito, volvía a comprar y quedaba duplicado.
--
--   · Los puntos se suman cuando el pago se aprueba, no al crear el pedido.
--   · Un pedido de la tienda sin pagar se cancela solo a los 30 minutos: devuelve el stock y los
--     puntos que se hubieran canjeado. No toca los lotes de subasta ni los envíos del Club.
--   · Confirmar dos veces lo mismo no crea dos pedidos: devuelve el que ya esperaba el pago.
--
-- Al ejecutarla se cancelan los pedidos viejos de la tienda que quedaron sin pagar.
-- Ejecutar DESPUÉS de la 023. Se puede ejecutar más de una vez.

-- ---------- 1. ¿Este pedido ya dio sus puntos? ----------
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'pedidos' and column_name = 'puntos_dados') then
    alter table public.pedidos add column puntos_dados boolean not null default false;
    -- Hasta hoy se daban al crear el pedido. Al cancelar los que no se pagaron, se restan.
    update public.pedidos set puntos_dados = true where puntos_ganados > 0 and estado <> 'cancelado';
  end if;
end $$;

-- ---------- 2. Dar los puntos: una sola vez y solo si está pagado ----------
create or replace function public.dar_puntos(p_pedido bigint)
returns void language plpgsql security definer set search_path = public
as $$
declare p public.pedidos;
begin
  update pedidos set puntos_dados = true
   where id = p_pedido and not puntos_dados and puntos_ganados > 0
     and cliente_id is not null and pago_estado = 'aprobado'
  returning * into p;
  if p.id is null then return; end if;
  update perfiles set puntos = puntos + p.puntos_ganados where id = p.cliente_id;
  insert into movimientos_puntos (cliente_id, pedido_id, puntos, motivo)
  values (p.cliente_id, p.id, p.puntos_ganados, 'Compra ' || p.codigo);
end;
$$;
revoke all on function public.dar_puntos(bigint) from public, anon, authenticated;

create or replace function public.pedido_pagado()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  perform public.dar_puntos(new.id);
  return null;
end;
$$;
drop trigger if exists pedido_pagado on public.pedidos;
create trigger pedido_pagado after update on public.pedidos
  for each row when (new.pago_estado = 'aprobado' and old.pago_estado is distinct from 'aprobado')
  execute function public.pedido_pagado();

-- ---------- 3. Deshacer un pedido ----------
-- Lo que hacía cancelar_pedido() de la 013b, en un solo lugar: lo usan el cliente, el equipo y el reloj.
create or replace function public.anular_pedido(p_pedido bigint, p_nota text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare p public.pedidos; quita int;
begin
  select * into p from pedidos where id = p_pedido for update;
  if not found or p.estado <> 'recibido' then return; end if;

  update pedidos set estado = 'cancelado', pago_nota = coalesce(p_nota, pago_nota) where id = p.id;
  update productos pr set stock = pr.stock + i.cantidad
    from (select producto_id, sum(cantidad)::int as cantidad from pedido_items where pedido_id = p.id group by producto_id) i
   where pr.id = i.producto_id;

  if p.cliente_id is not null and p.canal::text = 'web' then
    quita := case when p.puntos_dados then coalesce(p.puntos_ganados, 0) else 0 end;
    update perfiles set puntos = greatest(0, puntos + coalesce(p.puntos_usados, 0) - quita) where id = p.cliente_id;
    if coalesce(p.puntos_usados, 0) > 0 then
      insert into movimientos_puntos (cliente_id, pedido_id, puntos, motivo)
      values (p.cliente_id, p.id, p.puntos_usados, 'Devolución por cancelar ' || p.codigo);
    end if;
    if quita > 0 then
      insert into movimientos_puntos (cliente_id, pedido_id, puntos, motivo)
      values (p.cliente_id, p.id, -quita, 'Anulación de puntos por cancelar ' || p.codigo);
      update pedidos set puntos_dados = false where id = p.id;
    end if;
  end if;
end;
$$;
revoke all on function public.anular_pedido(bigint, text) from public, anon, authenticated;

create or replace function public.cancelar_pedido(p_pedido bigint)
returns void language plpgsql security definer set search_path = public
as $$
declare p public.pedidos;
begin
  select * into p from pedidos where id = p_pedido for update;
  if not found then raise exception 'No encontramos ese pedido'; end if;
  if not (coalesce(p.cliente_id = auth.uid(), false) or public.es_equipo()) then raise exception 'No puedes cancelar este pedido'; end if;
  if p.estado <> 'recibido' then raise exception 'El pedido ya está en preparación y no se puede cancelar'; end if;
  perform public.anular_pedido(p.id, null);
end;
$$;
revoke all on function public.cancelar_pedido(bigint) from public, anon;
grant execute on function public.cancelar_pedido(bigint) to authenticated;

-- ---------- 4. Sin pago en 30 minutos, se cancela solo ----------
create or replace function public.cancelar_sin_pagar()
returns integer language plpgsql security definer set search_path = public
as $$
declare r record; n integer := 0;
begin
  for r in select id from pedidos
            where canal::text = 'web' and metodo_pago = 'qr' and estado = 'recibido'
              and pago_estado in ('pendiente', 'rechazado') and creado_en < now() - interval '30 minutes'
              for update skip locked
  loop
    perform public.anular_pedido(r.id, 'Se canceló solo: no se pagó en 30 minutos');
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function public.cancelar_sin_pagar() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('pedidos-sin-pagar');
exception when others then null;
end $$;
do $$
begin
  perform cron.schedule('pedidos-sin-pagar', '* * * * *', $cmd$select public.cancelar_sin_pagar()$cmd$);
exception when others then
  raise notice 'pg_cron no disponible: los pedidos sin pagar se cancelan con  select public.cancelar_sin_pagar();';
end $$;

-- ---------- 5. El mismo pedido, otra vez ----------
create or replace function public.pedido_igual_sin_pagar(p_cliente uuid, p_items jsonb)
returns bigint language sql stable security definer set search_path = public
as $$
  select p.id from pedidos p
   where p.cliente_id = p_cliente and p.canal::text = 'web' and p.metodo_pago = 'qr'
     and p.estado = 'recibido' and p.pago_estado = 'pendiente'
     and p.creado_en > now() - interval '30 minutes'
     and (select array_agg(i.producto_id || '|' || coalesce(i.molienda, 'Única') || '|' || i.cantidad
                           order by i.producto_id, coalesce(i.molienda, 'Única'))
            from pedido_items i where i.pedido_id = p.id)
       = (select array_agg((x ->> 'producto_id') || '|' || coalesce(x ->> 'molienda', 'Única') || '|' || (x ->> 'cantidad')
                           order by x ->> 'producto_id', coalesce(x ->> 'molienda', 'Única'))
            from jsonb_array_elements(p_items) x)
   order by p.id desc limit 1;
$$;
revoke all on function public.pedido_igual_sin_pagar(uuid, jsonb) from public, anon, authenticated;

-- ---------- 6. Confirmar: sin duplicar y sin regalar puntos ----------
-- La misma función de la 023, con lo marcado "024".
create or replace function public.confirmar_pedido(
  items jsonb, p_canal public.canal default 'web', p_metodo text default 'qr',
  p_nombre text default null, p_telefono text default null, p_direccion text default null,
  p_referencia text default null, p_puntos integer default 0
) returns public.pedidos
language plpgsql security definer set search_path = public
as $$
declare
  it jsonb; prod public.productos; nuevo public.pedidos;
  suma numeric := 0; usa int := 0; rebaja numeric := 0; gana int := 0; n integer; ya public.pedidos;
  local boolean := p_canal::text in ('caja', 'totem');   -- ventas en el local: sin cliente con cuenta
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  if items is null or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then raise exception 'El pedido no tiene productos'; end if;
  if p_canal::text = 'caja' and not public.es_equipo() then raise exception 'Solo el equipo registra ventas de caja'; end if;
  if p_canal::text = 'totem' and not (public.es_totem() or public.es_equipo()) then
    raise exception 'Solo el tótem registra pedidos de autoservicio';
  end if;
  -- La cuenta del tótem no compra por la web: solo crea pedidos del tótem.
  if public.es_totem() and p_canal::text <> 'totem' then raise exception 'El tótem solo crea pedidos de autoservicio'; end if;

  -- 024: ¿ya tiene este mismo pedido esperando el pago? (cerró el carrito, recargó o tocó dos veces)
  if p_canal::text = 'web' then
    perform 1 from perfiles where id = auth.uid() for update;   -- de a una compra por cliente
    select * into ya from pedidos where id = public.pedido_igual_sin_pagar(auth.uid(), items) for update;
    if ya.id is not null and ya.estado = 'recibido' and ya.pago_estado = 'pendiente' then
      if p_metodo = 'qr' and coalesce(p_puntos, 0) = ya.puntos_usados then
        update pedidos
           set nombre = coalesce(p_nombre, nombre), telefono = coalesce(p_telefono, telefono),
               direccion = coalesce(p_direccion, direccion), referencia = coalesce(p_referencia, referencia)
         where id = ya.id
        returning * into ya;
        return ya;
      end if;
      -- Cambió de idea: ahora paga con tarjeta o con otros puntos. El anterior se deshace.
      perform public.anular_pedido(ya.id, 'Se reemplazó por otro pedido igual');
    end if;
  end if;

  insert into pedidos (cliente_id, canal, metodo_pago, nombre, telefono, direccion, referencia)
  values (case when local then null else auth.uid() end, p_canal, p_metodo, p_nombre, p_telefono, p_direccion, p_referencia)
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

  -- Canje (013 de Janet): se recalcula aquí; lo que manda el navegador es solo una intención.
  if nuevo.cliente_id is not null and coalesce(p_puntos, 0) > 0 then
    perform 1 from perfiles where id = nuevo.cliente_id for update;
    usa := public.puntos_aplicables(nuevo.cliente_id, suma, p_puntos);
    rebaja := public.bs_por_puntos(usa);
  end if;

  gana := case when nuevo.cliente_id is null then 0 else public.puntos_por_bs(suma - rebaja) end;

  -- Turno del día para el ticket del tótem (014): 1, 2, 3… y vuelve a empezar cada día.
  if p_canal::text = 'totem' then
    select coalesce(max(turno), 0) + 1 into n from pedidos
     where canal::text = 'totem' and id <> nuevo.id
       and (creado_en at time zone 'America/La_Paz')::date = (now() at time zone 'America/La_Paz')::date;
  end if;

  update pedidos
     set total = suma - rebaja, descuento = rebaja, puntos_usados = usa, puntos_ganados = gana, turno = n
   where id = nuevo.id
  returning * into nuevo;

  if nuevo.cliente_id is not null then
    if usa > 0 then
      update perfiles set puntos = puntos - usa where id = nuevo.cliente_id;
      insert into movimientos_puntos (cliente_id, pedido_id, puntos, motivo)
      values (nuevo.cliente_id, nuevo.id, -usa, 'Canje en el pedido ' || nuevo.codigo);
    end if;
    -- 024: los puntos ganados se suman al pagar. Con tarjeta ya está pagado; con QR, al escanear.
    if nuevo.pago_estado = 'aprobado' then
      perform public.dar_puntos(nuevo.id);
      select * into nuevo from pedidos where id = nuevo.id;
    end if;
  end if;

  return nuevo;
end;
$$;

-- ---------- 7. Limpieza: los que ya vencieron ----------
select public.cancelar_sin_pagar() as "pedidos sin pagar que se cancelaron";
