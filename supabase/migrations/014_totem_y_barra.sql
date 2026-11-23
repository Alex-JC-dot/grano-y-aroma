-- =====================================================================
-- Grano y Aroma · 014 · Tótem de autoservicio y pantalla de Barra
-- =====================================================================
-- Para la feria (EXPOSOFT): un tótem con pantalla táctil donde el cliente pide y paga solo,
-- y una pantalla de Barra donde el cajero o barista prepara esos pedidos. Nadie del admin
-- interviene: el pago con tarjeta se valida en el momento y cada rol hace su parte.
--
--   1. Rol "totem": la cuenta con la que se deja conectada la tablet del tótem. Solo puede
--      abrir /totem y crear pedidos del canal "totem". No ve nada más.
--   2. Canal "totem" y un número de TURNO corto por día (#001, #002…) para el ticket.
--   3. Pago con tarjeta aprobado al instante (como en la tienda en línea).
--   4. Barra: Nuevo → Preparando → Listo → Entregado. Los pedidos del tótem se retiran en el
--      mostrador, así que no llevan repartidor ni foto de entrega.
--
-- Nota: un valor nuevo de un enum no se puede usar en la misma transacción en que se crea,
-- por eso aquí se compara siempre como texto (p_canal::text = 'totem').
-- Ejecutar DESPUÉS de la 013. Se puede ejecutar más de una vez.

-- ---------- 1. Rol, canal y columnas ----------
alter type public.rol add value if not exists 'totem';
alter type public.canal add value if not exists 'totem';

alter table public.pedidos add column if not exists turno integer;        -- #047 en el ticket
alter table public.pedidos add column if not exists listo_en timestamptz; -- la barra lo marcó listo

create or replace function public.es_totem()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.mi_rol()::text = 'totem', false) $$;

-- ---------- 2. Crear pedidos (misma función de la 002, con el canal tótem) ----------
create or replace function public.confirmar_pedido(
  items jsonb, p_canal public.canal default 'web', p_metodo text default 'qr',
  p_nombre text default null, p_telefono text default null, p_direccion text default null, p_referencia text default null
) returns public.pedidos
language plpgsql security definer set search_path = public
as $$
declare
  it jsonb; prod public.productos; nuevo public.pedidos; suma numeric := 0; n integer;
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

  -- Turno del día para el ticket del tótem: 1, 2, 3… y vuelve a empezar cada día.
  if p_canal::text = 'totem' then
    select coalesce(max(turno), 0) + 1 into n from pedidos
     where canal::text = 'totem' and id <> nuevo.id
       and (creado_en at time zone 'America/La_Paz')::date = (now() at time zone 'America/La_Paz')::date;
    update pedidos set turno = n where id = nuevo.id;
  end if;

  update pedidos set total = suma where id = nuevo.id returning * into nuevo;
  -- 1 punto por cada Bs. 10 (RF-32)
  if nuevo.cliente_id is not null then
    update perfiles set puntos = puntos + floor(suma / 10)::int where id = nuevo.cliente_id;
  end if;
  return nuevo;
end;
$$;

-- ---------- 3. Pago: la tarjeta del tótem se aprueba al instante ----------
create or replace function public.pedido_pago_inicial()
returns trigger language plpgsql set search_path = public
as $$
begin
  if new.canal::text in ('web', 'totem') then
    new.pago_estado := case when new.metodo_pago = 'qr' then 'pendiente' else 'aprobado' end;
  end if;
  return new;
end;
$$;

-- ---------- 4. Reglas de estado (las de la 011, sin exigir reparto a lo que se retira en el local) ----------
create or replace function public.pedido_cambio_estado()
returns trigger language plpgsql set search_path = public
as $$
declare a_domicilio boolean := new.canal::text in ('web', 'subasta');
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

-- ---------- 5. Barra: Nuevo → Preparando → Listo → Entregado ----------
-- Lo opera el equipo (cajero/barista o admin). Cada paso queda con su hora y quién lo hizo.
create or replace function public.barra_avanzar(p_pedido bigint)
returns text language plpgsql security definer set search_path = public
as $$
declare p public.pedidos;
begin
  if not public.es_equipo() then raise exception 'Solo el equipo atiende la barra'; end if;
  select * into p from pedidos where id = p_pedido for update;
  if not found or p.canal::text <> 'totem' then raise exception 'Ese pedido no es de la barra'; end if;

  if p.estado = 'recibido' then
    update pedidos set estado = 'preparacion', preparado_por = auth.uid() where id = p.id;
    return 'preparando';
  elsif p.estado = 'preparacion' and p.listo_en is null then
    update pedidos set listo_en = now() where id = p.id;
    return 'listo';
  elsif p.estado = 'preparacion' then
    update pedidos set estado = 'entregado', entrega_registrada_por = auth.uid() where id = p.id;
    return 'entregado';
  end if;
  raise exception 'Este pedido ya fue entregado o cancelado';
end;
$$;

revoke all on function public.barra_avanzar(bigint) from public, anon;
grant execute on function public.barra_avanzar(bigint) to authenticated;
