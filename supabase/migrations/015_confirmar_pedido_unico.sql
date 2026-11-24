-- =====================================================================
-- Grano y Aroma · 015 · Una sola confirmar_pedido (canje de puntos + tótem)
-- =====================================================================
-- Arregla un choque: el canje de puntos (013b_canje_de_puntos, de Janet) dejó confirmar_pedido
-- con 8 parámetros (el último, p_puntos) y la 014 (tótem) volvió a crear la de 7. Con las
-- dos, PostgreSQL no sabe cuál llamar y fallan TODAS las compras (tienda, caja y tótem).
--
-- Aquí queda una sola, la de 8 parámetros, con todo lo de ambas:
--   · Canje de puntos (RF-32): descuento hasta el 50 %, historial y puntos ganados sobre lo
--     pagado. Tal cual lo dejó la 013 de Janet.
--   · Tótem (014): canal "totem" solo para la cuenta Tótem o el equipo, sin cliente (como la
--     caja) y con el número de turno del día para el ticket.
--
-- Requiere la 013b_canje_de_puntos y la 014 ya ejecutadas. Se puede ejecutar más de una vez.

drop function if exists public.confirmar_pedido(jsonb, public.canal, text, text, text, text, text);

create or replace function public.confirmar_pedido(
  items jsonb, p_canal public.canal default 'web', p_metodo text default 'qr',
  p_nombre text default null, p_telefono text default null, p_direccion text default null,
  p_referencia text default null, p_puntos integer default 0
) returns public.pedidos
language plpgsql security definer set search_path = public
as $$
declare
  it jsonb; prod public.productos; nuevo public.pedidos;
  suma numeric := 0; usa int := 0; rebaja numeric := 0; gana int := 0; n integer;
  local boolean := p_canal::text in ('caja', 'totem');   -- ventas en el local: sin cliente con cuenta
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  if p_canal::text = 'caja' and not public.es_equipo() then raise exception 'Solo el equipo registra ventas de caja'; end if;
  if p_canal::text = 'totem' and not (public.es_totem() or public.es_equipo()) then
    raise exception 'Solo el tótem registra pedidos de autoservicio';
  end if;
  -- La cuenta del tótem no compra por la web: solo crea pedidos del tótem.
  if public.es_totem() and p_canal::text <> 'totem' then raise exception 'El tótem solo crea pedidos de autoservicio'; end if;

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

revoke all on function public.confirmar_pedido(jsonb, public.canal, text, text, text, text, text, integer) from public, anon;
grant execute on function public.confirmar_pedido(jsonb, public.canal, text, text, text, text, text, integer) to authenticated;
