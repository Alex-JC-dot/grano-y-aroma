-- =====================================================================
-- Grano y Aroma · 007 · Paneles del equipo con datos reales
--   · Caja: bebidas y pastelería de la barra (RF-17 a RF-21).
--   · Bodega y tueste: café verde, insumos y lotes de tueste con merma
--     y código de trazabilidad (RF-22 a RF-26).
--   · Logística: repartidor del pedido (RF-29 a RF-31).
--   · Club: fecha de inicio y envíos saltados (RF-06 a RF-09).
--   · Usuarios: lista para que el admin cambie roles (RF-36).
-- Ejecutar DESPUÉS de 006 (usa la categoría 'bebida').
-- =====================================================================

-- ---------- Caja: la barra ----------
insert into public.productos (id, nombre, categoria, descripcion, precio, stock, stock_minimo, grupo, orden) values
  ('b1',  'Espresso',      'bebida', '', 15, 999, 0,  'Bebidas calientes', 1),
  ('b2',  'Americano',     'bebida', '', 18, 999, 0,  'Bebidas calientes', 2),
  ('b3',  'Cappuccino',    'bebida', '', 22, 999, 0,  'Bebidas calientes', 3),
  ('b4',  'Latte',         'bebida', '', 25, 999, 0,  'Bebidas calientes', 4),
  ('b5',  'Flat White',    'bebida', '', 28, 999, 0,  'Bebidas calientes', 5),
  ('b6',  'Matcha Latte',  'bebida', '', 30, 999, 0,  'Bebidas calientes', 6),
  ('b7',  'V60',           'bebida', '', 35, 999, 0,  'Métodos', 7),
  ('b8',  'Chemex',        'bebida', '', 40, 999, 0,  'Métodos', 8),
  ('b9',  'Cold Brew',     'bebida', '', 30, 20,  5,  'Bebidas frías', 9),
  ('b10', 'Iced Latte',    'bebida', '', 28, 30,  5,  'Bebidas frías', 10),
  ('b11', 'Affogato',      'bebida', '', 32, 15,  5,  'Bebidas frías', 11),
  ('b12', 'Croissant',     'bebida', '', 18, 12,  4,  'Pastelería', 12),
  ('b13', 'Brownie',       'bebida', '', 15, 18,  4,  'Pastelería', 13),
  ('b14', 'Cheesecake',    'bebida', '', 22, 8,   3,  'Pastelería', 14),
  ('b15', 'Agua mineral',  'bebida', '', 8,  50,  10, 'Otros', 15)
on conflict (id) do nothing;

-- ---------- Logística ----------
alter table public.pedidos add column if not exists repartidor text;

-- ---------- Club ----------
alter table public.suscripciones
  add column if not exists inicio date not null default (current_date + 3),
  add column if not exists saltos integer not null default 0;

-- ---------- Bodega y tueste ----------
create or replace function public.puede_bodega()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.mi_rol() in ('tostador', 'admin'), false) $$;

create table if not exists public.cafe_verde (
  id         bigint generated always as identity primary key,
  codigo     text unique not null,                 -- VS-2025-GRN-012
  nombre     text not null,
  origen     text,
  proveedor  text,
  kg         numeric(8,2) not null default 0 check (kg >= 0),
  kg_minimo  numeric(8,2) not null default 20,
  costo_kg   numeric(10,2),
  creado_en  timestamptz not null default now()
);

create table if not exists public.insumos (
  id        bigint generated always as identity primary key,
  nombre    text not null,
  cantidad  numeric(10,2) not null default 0 check (cantidad >= 0),
  unidad    text not null,
  minimo    numeric(10,2) not null default 0
);

create table if not exists public.tuestes (
  id          bigint generated always as identity primary key,
  codigo      text unique not null,                -- VS-2025-TOS-004
  verde_id    bigint references public.cafe_verde (id),
  kg_verde    numeric(8,2) not null check (kg_verde > 0),
  kg_tostado  numeric(8,2) not null check (kg_tostado > 0),
  perfil      text,
  puntaje     numeric(4,1),
  notas       text,
  producto_id text references public.productos (id),
  bolsas      integer not null default 0,
  creado_por  uuid references public.perfiles (id) default auth.uid(),
  creado_en   timestamptz not null default now(),
  check (kg_tostado <= kg_verde)
);

alter table public.cafe_verde enable row level security;
alter table public.insumos    enable row level security;
alter table public.tuestes    enable row level security;

create policy "equipo ve café verde"   on public.cafe_verde for select using (public.es_equipo());
create policy "bodega edita café verde" on public.cafe_verde for all using (public.puede_bodega()) with check (public.puede_bodega());
create policy "equipo ve insumos"      on public.insumos for select using (public.es_equipo());
create policy "equipo edita insumos"   on public.insumos for all using (public.es_equipo()) with check (public.es_equipo());
create policy "equipo ve tuestes"      on public.tuestes for select using (public.es_equipo());

-- El tostador puede reponer el stock de la tienda al embolsar (solo stock, vía registrar_tueste).

-- Registra un tueste: descuenta el café verde, calcula el código de trazabilidad y, si se
-- embolsó para la tienda, suma las bolsas de 250 g al stock del producto (RF-24 a RF-26).
create or replace function public.registrar_tueste(
  p_verde bigint, p_kg_verde numeric, p_kg_tostado numeric, p_perfil text,
  p_puntaje numeric default null, p_notas text default null,
  p_producto text default null, p_bolsas integer default 0
) returns public.tuestes
language plpgsql security definer set search_path = public
as $$
declare v public.cafe_verde; n integer; cod text; nuevo public.tuestes;
begin
  if not public.puede_bodega() then raise exception 'Solo el tostador o el admin registran tuestes'; end if;
  select * into v from cafe_verde where id = p_verde for update;
  if not found then raise exception 'Ese lote de café verde no existe'; end if;
  if p_kg_verde > v.kg then raise exception 'Solo quedan % kg de %', v.kg, v.nombre; end if;
  if p_kg_tostado > p_kg_verde then raise exception 'El café tostado no puede pesar más que el verde'; end if;
  if coalesce(p_bolsas, 0) > floor(p_kg_tostado / 0.25) then
    raise exception 'Con % kg tostados salen como máximo % bolsas de 250 g', p_kg_tostado, floor(p_kg_tostado / 0.25);
  end if;

  update cafe_verde set kg = kg - p_kg_verde where id = v.id;

  select count(*) + 1 into n from tuestes where codigo like split_part(v.codigo, '-', 1) || '-' || to_char(now(), 'YYYY') || '-TOS-%';
  cod := split_part(v.codigo, '-', 1) || '-' || to_char(now(), 'YYYY') || '-TOS-' || lpad(n::text, 3, '0');

  insert into tuestes (codigo, verde_id, kg_verde, kg_tostado, perfil, puntaje, notas, producto_id, bolsas)
  values (cod, v.id, p_kg_verde, p_kg_tostado, p_perfil, p_puntaje, p_notas, p_producto, coalesce(p_bolsas, 0))
  returning * into nuevo;

  if p_producto is not null and coalesce(p_bolsas, 0) > 0 then
    update productos set stock = stock + p_bolsas, fecha_tueste = current_date where id = p_producto;
  end if;
  return nuevo;
end;
$$;
revoke all on function public.registrar_tueste(bigint, numeric, numeric, text, numeric, text, text, integer) from public, anon;
grant execute on function public.registrar_tueste(bigint, numeric, numeric, text, numeric, text, text, integer) to authenticated;

-- Datos iniciales de bodega
insert into public.cafe_verde (codigo, nombre, origen, proveedor, kg, kg_minimo, costo_kg) values
  ('VS-2025-GRN-012',  'Café verde Villa Serrano', 'Villa Serrano, Chuquisaca', 'Productores de Villa Serrano', 80, 20, 48),
  ('PAD-2025-GRN-009', 'Café verde Padilla',       'Padilla, Chuquisaca',       'Familia Veizaga',              60, 20, 44),
  ('CAR-2025-GRN-008', 'Café verde Caranavi',      'Caranavi, Yungas',          'Cooperativa de Caranavi',      50, 20, 40),
  ('COR-2025-GRN-004', 'Café verde Coroico',       'Coroico, Yungas',           'Productores de Coroico',       15, 20, 38)
on conflict (codigo) do nothing;

insert into public.insumos (nombre, cantidad, unidad, minimo)
select * from (values
  ('Leche entera', 45, 'litros', 10), ('Leche de avena', 8, 'litros', 5), ('Azúcar', 12, 'kg', 5),
  ('Vasos desechables 8 oz', 200, 'unidades', 50), ('Filtros V60', 4, 'cajas', 2), ('Bolsas kraft 250 g', 120, 'unidades', 40)
) as v(nombre, cantidad, unidad, minimo)
where not exists (select 1 from public.insumos);

insert into public.tuestes (codigo, verde_id, kg_verde, kg_tostado, perfil, puntaje, notas, producto_id, bolsas, creado_por, creado_en)
select v.codigo, cv.id, v.kg_verde, v.kg_tostado, v.perfil, v.puntaje, v.notas, v.producto, v.bolsas, null, v.fecha
from (values
  ('VS-2025-TOS-001',  'VS-2025-GRN-012',  14.0, 12.0, 'Ligero · 195 °C pico · 11:30 min', 87.5, 'Excelente desarrollo. Acidez brillante.', 'p1', 48, timestamptz '2025-10-05 09:00-04'),
  ('PAD-2025-TOS-001', 'PAD-2025-GRN-009', 17.8, 15.0, 'Medio · 205 °C pico · 13:00 min',  86.0, 'Tueste balanceado. Notas a caramelo.',   'p2', 60, timestamptz '2025-10-03 09:00-04'),
  ('COR-2025-TOS-001', 'COR-2025-GRN-004', 24.1, 20.0, 'Oscuro · 215 °C pico · 14:30 min', 85.0, 'Para espresso. Full City+.',              'p4', 80, timestamptz '2025-09-28 09:00-04')
) as v(codigo, verde, kg_verde, kg_tostado, perfil, puntaje, notas, producto, bolsas, fecha)
join public.cafe_verde cv on cv.codigo = v.verde
on conflict (codigo) do nothing;

-- ---------- Usuarios (solo admin) ----------
create or replace function public.usuarios_admin()
returns table (id uuid, email text, nombre text, rol public.rol, puntos integer, creado_en timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.es_admin() then raise exception 'Solo el administrador ve los usuarios'; end if;
  return query
    select p.id, u.email::text, p.nombre, p.rol, p.puntos, p.creado_en
    from perfiles p join auth.users u on u.id = p.id
    order by p.rol desc, p.creado_en;
end;
$$;
revoke all on function public.usuarios_admin() from public, anon;
grant execute on function public.usuarios_admin() to authenticated;

-- Tiempo real de pedidos para logística y la caja.
alter publication supabase_realtime add table public.pedidos;
