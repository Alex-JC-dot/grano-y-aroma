-- =====================================================================
-- Grano y Aroma · 023 · El Club y las subastas llegan hasta la entrega
-- =====================================================================
-- Dos procesos se cortaban a la mitad:
--   · Club: el cliente pagaba su envío y nadie del equipo lo recibía. Ahora, al aprobarse el
--     cobro, se crea el pedido solo (descuenta stock) y sigue el camino de siempre: Logística lo
--     prepara y despacha, y el repartidor lo entrega con su prueba.
--   · Subastas: quien ganaba tenía un pedido "por definir", sin forma de pagar ni dirección. Ahora
--     el pedido se paga por QR desde Mi cuenta y lleva los datos de envío del ganador.
--
-- Además:
--   · datos_envio(): el cliente completa teléfono y dirección de un pedido que todavía no sale.
--   · Seguridad: un cliente podía asignarse puntos a sí mismo. La protección de la 001 no servía
--     porque, al ser "security definer", siempre se creía el dueño de la base.
--
--   · Un pedido sin productos se rechaza y el cierre de subastas ya no lo puede llamar cualquiera.
--
-- Ejecutar DESPUÉS de la 022. Se puede ejecutar más de una vez.

-- ---------- 1. Reglas de estado: los envíos del Club también van a domicilio ----------
create or replace function public.pedido_cambio_estado()
returns trigger language plpgsql set search_path = public
as $$
declare a_domicilio boolean := new.canal::text in ('web', 'subasta', 'club');
begin
  if new.estado is distinct from old.estado then
    -- 009: el pago manda.
    if old.estado = 'recibido' and new.estado in ('preparacion', 'en_camino', 'entregado')
       and new.pago_estado in ('pendiente', 'por_verificar', 'rechazado') then
      raise exception 'El pago de este pedido todavía no está aprobado';
    end if;

    -- 011: cada etapa deja constancia de quién la hizo.
    if new.estado = 'preparacion' and new.preparado_por is null then
      raise exception 'Hay que registrar quién prepara el pedido';
    end if;
    if a_domicilio and new.estado = 'en_camino' and new.repartidor_id is null then
      raise exception 'Hay que asignar el repartidor antes de despachar el pedido';
    end if;

    -- 010: no se entrega a domicilio sin evidencia (en el mostrador la entrega es en mano).
    if a_domicilio and new.estado = 'entregado'
       and (nullif(trim(coalesce(new.entrega_foto, '')), '') is null
            or nullif(trim(coalesce(new.entrega_recibido_por, '')), '') is null) then
      raise exception 'Para cerrar la entrega hace falta la foto y el nombre de quien recibió';
    end if;

    -- 023: un envío del Club se pausa desde el Club y un lote ganado es un compromiso.
    if new.estado = 'cancelado' and new.canal::text in ('club', 'subasta') and not public.es_equipo() then
      raise exception 'Ese pedido no se cancela desde aquí: escríbenos';
    end if;

    case new.estado
      when 'preparacion' then new.preparacion_en := now();
      when 'en_camino'   then new.en_camino_en := now();
      when 'entregado'   then new.entregado_en := now();
      when 'cancelado'   then new.cancelado_en := now();
      else null;
    end case;
  end if;
  return new;
end;
$$;

-- ---------- 2. Club: al pagar, nace el pedido ----------
alter table public.cobros_club add column if not exists pedido_id bigint references public.pedidos(id) on delete set null;

create or replace function public.crear_pedido_club(p_cobro bigint)
returns bigint language plpgsql security definer set search_path = public
as $$
declare
  c public.cobros_club; s public.suscripciones; f public.perfiles; prod public.productos;
  bolsas int; ped bigint;
begin
  select * into c from cobros_club where id = p_cobro;
  if not found or c.pedido_id is not null then return c.pedido_id; end if;
  select * into s from suscripciones where id = c.suscripcion_id;
  select * into f from perfiles where id = c.cliente_id;
  bolsas := greatest(1, s.gramos / 250);

  -- El café elegido; con "Sorpresa", el de más stock que no sea el último que recibió.
  if s.cafe <> 'sorpresa' then
    select * into prod from productos where id = s.cafe for update;
  end if;
  if prod.id is null then
    select p.* into prod from productos p
     where p.activo and p.categoria::text = 'grano'
     order by (p.stock >= bolsas) desc,
              (p.id = (select i.producto_id from pedidos pe join pedido_items i on i.pedido_id = pe.id
                        where pe.cliente_id = c.cliente_id and pe.canal::text = 'club'
                        order by pe.id desc limit 1)) is not true desc,
              p.stock desc
     limit 1 for update;
  end if;
  if prod.id is null then raise exception 'No hay café disponible para el envío del Club'; end if;

  insert into pedidos (cliente_id, canal, metodo_pago, total, nombre, telefono, direccion, referencia,
                       pago_estado, pago_revisado_en)
  values (c.cliente_id, 'club', 'qr', c.monto, f.nombre, f.telefono, f.direccion,
          'Club · envío del ' || to_char(c.periodo, 'DD/MM/YYYY') || case when s.cafe = 'sorpresa' then ' · sorpresa' else '' end,
          'aprobado', now())
  returning id into ped;

  insert into pedido_items (pedido_id, producto_id, cantidad, molienda, precio)
  values (ped, prod.id, bolsas, coalesce(s.molienda, 'Grano entero'), round(c.monto / bolsas, 2));
  -- El envío ya está pagado: si faltara stock no se rechaza, queda en cero y Bodega lo repone.
  update productos set stock = greatest(0, stock - bolsas) where id = prod.id;

  update cobros_club set pedido_id = ped where id = c.id;
  return ped;
end;
$$;
revoke all on function public.crear_pedido_club(bigint) from public, anon, authenticated;

create or replace function public.cobro_club_pagado()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  perform public.crear_pedido_club(new.id);
  return null;
end;
$$;
drop trigger if exists cobro_club_pagado on public.cobros_club;
create trigger cobro_club_pagado after update of estado on public.cobros_club
  for each row when (new.estado = 'aprobado' and old.estado is distinct from 'aprobado' and new.pedido_id is null)
  execute function public.cobro_club_pagado();

-- Envíos ya pagados que todavía no salieron: también reciben su pedido.
do $$
declare r record;
begin
  for r in select c.id from public.cobros_club c join public.suscripciones s on s.id = c.suscripcion_id
            where c.estado = 'aprobado' and c.pedido_id is null and c.periodo >= current_date and s.estado <> 'cancelada'
  loop
    perform public.crear_pedido_club(r.id);
  end loop;
end $$;

-- ---------- 3. Subastas: el ganador paga y recibe ----------
create or replace function public.cerrar_subastas_vencidas()
returns integer
language plpgsql security definer set search_path = public
as $$
declare s public.subastas; f public.perfiles; n integer := 0; ped bigint;
begin
  -- La llama el reloj de la base (sin sesión) o el admin al terminar un lote.
  if auth.uid() is not null and not public.es_admin() then raise exception 'Solo un administrador cierra subastas'; end if;
  update subastas set estado = 'activa' where estado = 'proxima' and now() >= abre_en;
  for s in select * from subastas where estado = 'activa' and now() >= cierra_en for update skip locked loop
    ped := null;
    if s.lider_id is not null then
      select * into f from perfiles where id = s.lider_id;
      insert into pedidos (cliente_id, canal, total, metodo_pago, nombre, telefono, direccion, referencia, pago_estado)
      values (s.lider_id, 'subasta', s.puja_actual, 'qr', 'Subasta: ' || s.titulo, f.telefono, f.direccion,
              'Para ' || coalesce(f.nombre, 'el ganador'), 'pendiente')
      returning id into ped;
    end if;
    update subastas set estado = 'cerrada', ganador_id = s.lider_id, ganador_nombre = s.lider_nombre, pedido_id = ped
     where id = s.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Los lotes ganados antes, que quedaron "por definir", ya se pueden pagar.
update public.pedidos p
   set metodo_pago = 'qr', pago_estado = 'pendiente',
       telefono = coalesce(p.telefono, f.telefono), direccion = coalesce(p.direccion, f.direccion),
       referencia = coalesce(p.referencia, 'Para ' || coalesce(f.nombre, 'el ganador'))
  from public.perfiles f
 where f.id = p.cliente_id and p.canal::text = 'subasta' and p.estado = 'recibido' and p.metodo_pago = 'pendiente';

-- ---------- 4. Datos de envío de un pedido propio ----------
create or replace function public.datos_envio(p_pedido bigint, p_telefono text, p_direccion text)
returns void language plpgsql security definer set search_path = public
as $$
declare t text := nullif(trim(coalesce(p_telefono, '')), ''); d text := nullif(trim(coalesce(p_direccion, '')), '');
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  if t is null or length(regexp_replace(t, '\D', '', 'g')) < 7 then raise exception 'Escribe un teléfono de al menos 7 dígitos'; end if;
  if d is null or length(d) < 5 then raise exception 'Escribe la dirección completa'; end if;
  update pedidos set telefono = t, direccion = d
   where id = p_pedido and cliente_id = auth.uid() and estado in ('recibido', 'preparacion');
  if not found then raise exception 'Ese pedido ya salió o no es tuyo'; end if;
  update perfiles set telefono = t, direccion = d where id = auth.uid();
end;
$$;
revoke all on function public.datos_envio(bigint, text, text) from public, anon;
grant execute on function public.datos_envio(bigint, text, text) to authenticated;

-- ---------- 5. Los puntos y el rol no se tocan desde el navegador ----------
-- Sin "security definer": así current_user es quien de verdad hace el cambio. Desde el navegador es
-- "authenticated"; desde las funciones de la base (confirmar_pedido, cancelar_pedido…), su dueño.
create or replace function public.proteger_rol()
returns trigger language plpgsql set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') then return new; end if;
  if new.rol is distinct from old.rol and not public.es_admin() then
    raise exception 'Solo un administrador puede cambiar roles';
  end if;
  if new.puntos is distinct from old.puntos then
    raise exception 'Los puntos solo los asigna el sistema';
  end if;
  return new;
end;
$$;

-- ---------- 6. Un pedido sin productos no existe ----------
-- La misma función de la 015, con esa única comprobación al empezar.
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
  if items is null or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then raise exception 'El pedido no tiene productos'; end if;
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

revoke all on function public.cerrar_subastas_vencidas() from public, anon;
grant execute on function public.cerrar_subastas_vencidas() to authenticated;

select 'pedidos del Club' as dato, count(*) from public.pedidos where canal::text = 'club'
union all select 'lotes ganados por pagar', count(*) from public.pedidos where canal::text = 'subasta' and pago_estado = 'pendiente';
