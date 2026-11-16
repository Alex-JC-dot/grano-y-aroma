-- =====================================================================
-- Grano y Aroma · 011 · Proveedores, compras y trazabilidad del pedido
-- =====================================================================
-- Qué resuelve:
--
--   A) Proveedores y compras (RF-27 a RF-29). Hasta ahora "proveedor" era un campo de texto
--      suelto dentro del café verde: no había a quién comprarle, ni órdenes de compra, ni
--      forma de registrar una recepción. Se agrega el módulo completo.
--
--   B) Trazabilidad del pedido. El docente señaló que mover un pedido no podía ser apretar
--      "En preparación" y ya. Ahora cada etapa deja constancia de QUIÉN la hizo:
--        · Preparación: quién lo armó y con qué nota.
--        · Despacho:    qué repartidor lo lleva, con su teléfono y vehículo.
--        · Entrega:     foto, quién recibió y, si se toma, su firma.
--      Las reglas viven en la base: no se puede saltar una etapa ni cerrarla sin su
--      evidencia, aunque alguien intente hacerlo con un UPDATE directo.
--
-- Aditiva: no borra tablas ni columnas. Reemplaza funciones de 009 y 010 conservando todo
-- lo que ya hacían. Se puede ejecutar más de una vez.
-- Ejecutar DESPUÉS de 010.

-- =====================================================================
-- A) PROVEEDORES Y COMPRAS
-- =====================================================================

create table if not exists public.proveedores (
  id         bigint generated always as identity primary key,
  nombre     text not null,
  contacto   text,                                   -- persona con quien se habla
  telefono   text,
  correo     text,
  region     text,                                   -- "Caranavi, La Paz"
  notas      text,
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);
comment on table public.proveedores is 'Productores y proveedores de café verde e insumos (RF-27).';

-- Estados de una orden: borrador (se está armando) · enviada (ya se le pidió al proveedor) ·
-- recibida (llegó y entró a bodega) · cancelada.
create table if not exists public.ordenes_compra (
  id            bigint generated always as identity primary key,
  codigo        text unique not null,
  proveedor_id  bigint not null references public.proveedores(id) on delete restrict,
  estado        text not null default 'borrador',
  notas         text,
  creado_por    uuid references public.perfiles(id) default auth.uid(),
  creado_en     timestamptz not null default now(),
  enviada_en    timestamptz,
  recibida_en   timestamptz,
  recibida_por  uuid references public.perfiles(id),
  cancelada_en  timestamptz
);
alter table public.ordenes_compra drop constraint if exists ordenes_compra_estado_check;
alter table public.ordenes_compra add constraint ordenes_compra_estado_check
  check (estado in ('borrador', 'enviada', 'recibida', 'cancelada'));

-- Cada línea es un lote de café verde que se va a comprar. Al recibir la orden, estas
-- líneas se convierten en existencias reales de bodega.
create table if not exists public.orden_items (
  id           bigint generated always as identity primary key,
  orden_id     bigint not null references public.ordenes_compra(id) on delete cascade,
  codigo       text not null,                        -- código del lote verde: VS-2026-GRN-014
  nombre       text not null,                        -- "Villa Serrano Natural"
  origen       text,
  kg           numeric(8,2) not null check (kg > 0),
  costo_kg     numeric(10,2) not null check (costo_kg >= 0)
);

-- El café verde pasa a apuntar al proveedor de verdad. La columna de texto se conserva para
-- no romper lo que ya hay cargado ni las pantallas que la leen.
alter table public.cafe_verde add column if not exists proveedor_id bigint;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cafe_verde_proveedor_id_fkey') then
    alter table public.cafe_verde add constraint cafe_verde_proveedor_id_fkey
      foreign key (proveedor_id) references public.proveedores(id) on delete set null;
  end if;
end $$;

-- Total de una orden, calculado y no guardado: un total guardado se desincroniza de sus
-- líneas en cuanto alguien edita una.
create or replace function public.total_orden(p_orden bigint)
returns numeric language sql stable set search_path = public
as $$ select coalesce(sum(kg * costo_kg), 0) from orden_items where orden_id = p_orden $$;

-- Recibir una orden: entra a bodega y suma al stock. Si el lote ya existe (mismo código),
-- suma los kilos; si no, lo crea. Así una segunda compra del mismo lote no duplica filas.
create or replace function public.recibir_orden_compra(p_orden bigint)
returns void language plpgsql security definer set search_path = public
as $$
declare o public.ordenes_compra; it public.orden_items;
begin
  if not public.puede_bodega() then raise exception 'Solo bodega o el administrador reciben órdenes'; end if;

  select * into o from ordenes_compra where id = p_orden for update;
  if not found then raise exception 'No encontramos esa orden'; end if;
  if o.estado = 'recibida' then raise exception 'Esta orden ya fue recibida'; end if;
  if o.estado = 'cancelada' then raise exception 'Esta orden está cancelada'; end if;
  if not exists (select 1 from orden_items where orden_id = p_orden) then
    raise exception 'La orden no tiene ningún lote cargado';
  end if;

  for it in select * from orden_items where orden_id = p_orden loop
    insert into cafe_verde (codigo, nombre, origen, proveedor, proveedor_id, kg, costo_kg)
    values (it.codigo, it.nombre, it.origen,
            (select nombre from proveedores where id = o.proveedor_id), o.proveedor_id,
            it.kg, it.costo_kg)
    on conflict (codigo) do update
      set kg = cafe_verde.kg + excluded.kg,
          costo_kg = excluded.costo_kg,
          proveedor_id = excluded.proveedor_id,
          proveedor = excluded.proveedor;
  end loop;

  update ordenes_compra
     set estado = 'recibida', recibida_en = now(), recibida_por = auth.uid()
   where id = p_orden;
end;
$$;

alter table public.proveedores    enable row level security;
alter table public.ordenes_compra enable row level security;
alter table public.orden_items    enable row level security;

-- El equipo los ve; bodega y administración los editan.
drop policy if exists "equipo ve proveedores" on public.proveedores;
drop policy if exists "bodega edita proveedores" on public.proveedores;
create policy "equipo ve proveedores" on public.proveedores for select using (public.es_equipo());
create policy "bodega edita proveedores" on public.proveedores for all
  using (public.puede_bodega()) with check (public.puede_bodega());

drop policy if exists "equipo ve ordenes" on public.ordenes_compra;
drop policy if exists "bodega edita ordenes" on public.ordenes_compra;
create policy "equipo ve ordenes" on public.ordenes_compra for select using (public.es_equipo());
create policy "bodega edita ordenes" on public.ordenes_compra for all
  using (public.puede_bodega()) with check (public.puede_bodega());

drop policy if exists "equipo ve items de orden" on public.orden_items;
drop policy if exists "bodega edita items de orden" on public.orden_items;
create policy "equipo ve items de orden" on public.orden_items for select using (public.es_equipo());
create policy "bodega edita items de orden" on public.orden_items for all
  using (public.puede_bodega()) with check (public.puede_bodega());

revoke all on function public.recibir_orden_compra(bigint) from public, anon;
grant execute on function public.recibir_orden_compra(bigint) to authenticated;

-- =====================================================================
-- B) TRAZABILIDAD DEL PEDIDO
-- =====================================================================

-- Repartidores: hasta ahora el nombre se escribía a mano en cada pedido, con lo que el mismo
-- repartidor aparecía escrito de tres formas distintas y no se podía saber cuántos pedidos
-- llevaba. Ahora se elige de una lista.
create table if not exists public.repartidores (
  id        bigint generated always as identity primary key,
  nombre    text not null,
  telefono  text,
  vehiculo  text,                                    -- "Moto roja, placa 1234-ABC"
  activo    boolean not null default true,
  creado_en timestamptz not null default now()
);

alter table public.repartidores enable row level security;
drop policy if exists "equipo ve repartidores" on public.repartidores;
drop policy if exists "admin edita repartidores" on public.repartidores;
create policy "equipo ve repartidores" on public.repartidores for select using (public.es_equipo());
create policy "admin edita repartidores" on public.repartidores for all
  using (public.es_admin()) with check (public.es_admin());

-- Quién hizo cada etapa. Las horas ya las guardaba la 009.
alter table public.pedidos add column if not exists preparado_por uuid;
alter table public.pedidos add column if not exists preparado_nota text;
alter table public.pedidos add column if not exists despachado_por uuid;
alter table public.pedidos add column if not exists repartidor_id bigint;
alter table public.pedidos add column if not exists entrega_firma text;   -- ruta en el bucket entregas

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pedidos_preparado_por_fkey') then
    alter table public.pedidos add constraint pedidos_preparado_por_fkey
      foreign key (preparado_por) references public.perfiles(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pedidos_despachado_por_fkey') then
    alter table public.pedidos add constraint pedidos_despachado_por_fkey
      foreign key (despachado_por) references public.perfiles(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pedidos_repartidor_id_fkey') then
    alter table public.pedidos add constraint pedidos_repartidor_id_fkey
      foreign key (repartidor_id) references public.repartidores(id) on delete set null;
  end if;
end $$;

-- ---------- Reglas de estado ----------
-- Reemplaza la función de la 010 conservando sus tres reglas y sumando dos: no se prepara
-- sin saber quién, y no sale a reparto sin repartidor asignado.
create or replace function public.pedido_cambio_estado()
returns trigger language plpgsql set search_path = public
as $$
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
    if new.estado = 'en_camino' and new.repartidor_id is null then
      raise exception 'Hay que asignar el repartidor antes de despachar el pedido';
    end if;

    -- 010: no se entrega sin evidencia.
    if new.estado = 'entregado'
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
drop trigger if exists pedido_cambio_estado on public.pedidos;
create trigger pedido_cambio_estado before update on public.pedidos
  for each row execute function public.pedido_cambio_estado();

-- ---------- Funciones de cada etapa ----------
-- Empezar a preparar: queda registrado quién lo arma.
create or replace function public.registrar_preparacion(p_pedido bigint, p_nota text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare p public.pedidos;
begin
  if not public.es_equipo() then raise exception 'Solo el equipo prepara pedidos'; end if;
  select * into p from pedidos where id = p_pedido for update;
  if not found then raise exception 'No encontramos ese pedido'; end if;
  if p.estado <> 'recibido' then raise exception 'Este pedido ya pasó de "Recibido"'; end if;

  update pedidos
     set estado = 'preparacion',
         preparado_por = auth.uid(),
         preparado_nota = nullif(trim(coalesce(p_nota, '')), '')
   where id = p_pedido;
end;
$$;

-- Despachar: se elige el repartidor de la lista y queda quién lo despachó.
create or replace function public.registrar_despacho(p_pedido bigint, p_repartidor bigint)
returns void language plpgsql security definer set search_path = public
as $$
declare p public.pedidos; r public.repartidores;
begin
  if not public.es_equipo() then raise exception 'Solo el equipo despacha pedidos'; end if;

  select * into r from repartidores where id = p_repartidor and activo;
  if not found then raise exception 'Ese repartidor no existe o está dado de baja'; end if;

  select * into p from pedidos where id = p_pedido for update;
  if not found then raise exception 'No encontramos ese pedido'; end if;
  if p.estado <> 'preparacion' then raise exception 'El pedido tiene que estar en preparación para poder despacharlo'; end if;

  update pedidos
     set estado = 'en_camino',
         repartidor_id = r.id,
         repartidor = r.nombre,     -- se mantiene el texto: lo leen pantallas y reportes viejos
         despachado_por = auth.uid()
   where id = p_pedido;
end;
$$;

-- Entregar: igual que en la 010, ahora admitiendo la firma de quien recibe.
create or replace function public.registrar_entrega(
  p_pedido bigint,
  p_foto text,
  p_recibido_por text,
  p_tipo text default 'titular',
  p_nota text default null,
  p_firma text default null
)
returns void language plpgsql security definer set search_path = public
as $$
declare p public.pedidos;
begin
  if not public.es_equipo() then raise exception 'Solo el equipo registra entregas'; end if;
  if nullif(trim(coalesce(p_foto, '')), '') is null then raise exception 'Falta la foto de la entrega'; end if;
  if nullif(trim(coalesce(p_recibido_por, '')), '') is null then raise exception 'Falta el nombre de quien recibió'; end if;

  select * into p from pedidos where id = p_pedido for update;
  if not found then raise exception 'No encontramos ese pedido'; end if;
  if p.estado = 'entregado' then raise exception 'Este pedido ya figura como entregado'; end if;
  if p.estado = 'cancelado' then raise exception 'Este pedido está cancelado'; end if;
  if p.estado not in ('preparacion', 'en_camino') then
    raise exception 'El pedido tiene que estar en preparación o en camino para poder entregarlo';
  end if;

  update pedidos
     set estado = 'entregado',
         entrega_foto = p_foto,
         entrega_recibido_por = trim(p_recibido_por),
         entrega_tipo = coalesce(nullif(trim(coalesce(p_tipo, '')), ''), 'titular'),
         entrega_nota = nullif(trim(coalesce(p_nota, '')), ''),
         entrega_firma = nullif(trim(coalesce(p_firma, '')), ''),
         entrega_registrada_por = auth.uid()
   where id = p_pedido;
end;
$$;

revoke all on function public.registrar_preparacion(bigint, text) from public, anon;
revoke all on function public.registrar_despacho(bigint, bigint) from public, anon;
revoke all on function public.registrar_entrega(bigint, text, text, text, text, text) from public, anon;
grant execute on function public.registrar_preparacion(bigint, text) to authenticated;
grant execute on function public.registrar_despacho(bigint, bigint) to authenticated;
grant execute on function public.registrar_entrega(bigint, text, text, text, text, text) to authenticated;

-- La versión de 5 argumentos de la 010 queda obsoleta: si no se quita, PostgreSQL no sabe
-- cuál de las dos llamar cuando el frontend manda cinco.
drop function if exists public.registrar_entrega(bigint, text, text, text, text);

-- =====================================================================
-- C) DATOS DE ARRANQUE
-- =====================================================================
-- Sin repartidores cargados no se puede despachar ningún pedido, así que van dos para que
-- el sistema sea usable apenas se aplica esta migración. El admin los edita desde el panel.
insert into public.repartidores (nombre, telefono, vehiculo)
select * from (values
  ('Carlos Mamani', '70012345', 'Moto roja · placa 1234-ABC'),
  ('Lucía Vargas',  '70098765', 'Moto blanca · placa 5678-XYZ')
) as v(nombre, telefono, vehiculo)
where not exists (select 1 from public.repartidores);

-- Un proveedor de ejemplo con los productores que ya aparecen en los cafés del catálogo.
insert into public.proveedores (nombre, contacto, telefono, region, notas)
select * from (values
  ('Finca Villa Serrano', 'Don Mario Céspedes', '71234567', 'Villa Serrano, Chuquisaca', 'Lotes naturales. Cosecha de junio a agosto.'),
  ('Asociación Padilla',  'Rosa Flores',        '72345678', 'Padilla, Chuquisaca',       'Beneficio lavado. Entrega en Sucre.')
) as v(nombre, contacto, telefono, region, notas)
where not exists (select 1 from public.proveedores);
