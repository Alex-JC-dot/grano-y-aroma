-- =====================================================================
-- Grano y Aroma · 002 · Catálogo, pedidos, Club, subastas y contacto
-- Reglas críticas dentro de la base de datos (no en el navegador):
--   · confirmar_pedido: descuenta stock en la misma transacción (RF-21).
--   · realizar_puja: bloquea la fila de la subasta (FOR UPDATE) para que
--     dos pujas simultáneas no puedan ganar a la vez (RF-12, RNF-09).
--   · cerrar_subastas_vencidas: cierra, fija un solo ganador y crea su
--     orden de compra (RF-14, RF-15).
-- =====================================================================

-- ---------- Catálogo (RF-01, RF-05) ----------
create type public.categoria as enum ('grano', 'molido', 'jarabe', 'equipo', 'accesorio');

create table public.productos (
  id            text primary key,                 -- p1, p2… (coincide con la web)
  nombre        text not null,
  categoria     public.categoria not null default 'grano',
  descripcion   text not null default '',
  presentacion  text,
  precio        numeric(10,2) not null check (precio >= 0),
  stock         integer not null default 0 check (stock >= 0),
  stock_minimo  integer not null default 5,
  -- trazabilidad (solo café)
  origen        text, region text, altitud integer,
  tueste        text, perfil text[], codigo_lote text,
  puntaje       numeric(4,1), fecha_tueste date,
  activo        boolean not null default true,
  creado_en     timestamptz not null default now()
);

-- ---------- Pedidos (RF-02, RF-03, RF-04) ----------
create type public.estado_pedido as enum ('recibido', 'preparacion', 'en_camino', 'entregado', 'cancelado');
create type public.canal as enum ('web', 'caja', 'club', 'subasta');

create table public.pedidos (
  id          bigint generated always as identity primary key,
  codigo      text unique not null default ('GA-' || to_char(now(), 'YYMMDD') || '-' || lpad((floor(random() * 10000))::text, 4, '0')),
  cliente_id  uuid references public.perfiles (id),      -- null en ventas de caja sin cliente
  canal       public.canal not null default 'web',
  estado      public.estado_pedido not null default 'recibido',
  metodo_pago text not null default 'qr',
  total       numeric(10,2) not null default 0,
  nombre      text, telefono text, direccion text, referencia text,
  creado_en   timestamptz not null default now()
);

create table public.pedido_items (
  pedido_id   bigint not null references public.pedidos (id) on delete cascade,
  producto_id text not null references public.productos (id),
  cantidad    integer not null check (cantidad > 0),
  molienda    text,
  precio      numeric(10,2) not null,
  primary key (pedido_id, producto_id, molienda)
);

-- Confirma un pedido de la web o de la caja: valida stock, lo descuenta y suma puntos.
-- items: [{"producto_id":"p1","cantidad":2,"molienda":"V60"}, …]
create or replace function public.confirmar_pedido(
  items jsonb, p_canal public.canal default 'web', p_metodo text default 'qr',
  p_nombre text default null, p_telefono text default null, p_direccion text default null, p_referencia text default null
) returns public.pedidos
language plpgsql security definer set search_path = public
as $$
declare
  it jsonb; prod public.productos; nuevo public.pedidos; suma numeric := 0;
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

  update pedidos set total = suma where id = nuevo.id returning * into nuevo;
  -- 1 punto por cada Bs. 10 (RF-32)
  if nuevo.cliente_id is not null then
    update perfiles set puntos = puntos + floor(suma / 10)::int where id = nuevo.cliente_id;
  end if;
  return nuevo;
end;
$$;

-- ---------- Club (RF-06 a RF-09) ----------
create type public.estado_sub as enum ('activa', 'pausada', 'cancelada');

create table public.suscripciones (
  id           bigint generated always as identity primary key,
  cliente_id   uuid not null references public.perfiles (id) on delete cascade,
  frecuencia   integer not null check (frecuencia in (15, 30)),
  gramos       integer not null check (gramos in (250, 500, 1000)),
  cafe         text not null default 'sorpresa',          -- 'sorpresa' o id de producto
  molienda     text not null default 'Grano entero',
  precio       numeric(10,2) not null,
  estado       public.estado_sub not null default 'activa',
  proximo_envio date not null default (current_date + 3),
  pausa_hasta  date,
  creado_en    timestamptz not null default now()
);
create unique index una_sub_vigente on public.suscripciones (cliente_id) where estado <> 'cancelada';

-- ---------- Subastas (RF-10 a RF-16) ----------
create type public.estado_subasta as enum ('proxima', 'activa', 'cerrada');

create table public.subastas (
  id            bigint generated always as identity primary key,
  titulo        text not null,
  descripcion   text not null default '',
  origen        text not null default '',
  altitud       integer, cantidad_kg numeric(6,1), puntaje numeric(4,1), codigo_lote text,
  imagen        text,
  precio_base   numeric(10,2) not null check (precio_base > 0),
  incremento    numeric(10,2) not null default 20,
  puja_actual   numeric(10,2),
  lider_id      uuid references public.perfiles (id),
  abre_en       timestamptz not null default now(),
  cierra_en     timestamptz not null,
  estado        public.estado_subasta not null default 'activa',
  ganador_id    uuid references public.perfiles (id),
  pedido_id     bigint references public.pedidos (id),
  creado_por    uuid references public.perfiles (id) default auth.uid(),
  check (cierra_en > abre_en)
);

create table public.pujas (
  id          bigint generated always as identity primary key,
  subasta_id  bigint not null references public.subastas (id) on delete cascade,
  postor_id   uuid not null references public.perfiles (id),
  monto       numeric(10,2) not null,
  creado_en   timestamptz not null default now()
);
create index on public.pujas (subasta_id, monto desc);

-- Puja segura: bloquea la subasta, valida el mínimo y el plazo, y registra.
create or replace function public.realizar_puja(p_subasta bigint, p_monto numeric)
returns public.subastas
language plpgsql security definer set search_path = public
as $$
declare s public.subastas; minimo numeric;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión para pujar'; end if;
  select * into s from subastas where id = p_subasta for update;          -- RNF-09
  if not found then raise exception 'La subasta no existe'; end if;
  if s.estado <> 'activa' or now() < s.abre_en or now() >= s.cierra_en then
    raise exception 'La subasta no está abierta';
  end if;
  minimo := coalesce(s.puja_actual + s.incremento, s.precio_base);
  if p_monto < minimo then raise exception 'La puja mínima es Bs. %', minimo; end if;

  insert into pujas (subasta_id, postor_id, monto) values (p_subasta, auth.uid(), p_monto);
  update subastas set puja_actual = p_monto, lider_id = auth.uid() where id = p_subasta returning * into s;
  return s;
end;
$$;

-- Cierre automático: lo llama pg_cron cada minuto (ver 003). Un solo ganador por subasta.
create or replace function public.cerrar_subastas_vencidas()
returns integer
language plpgsql security definer set search_path = public
as $$
declare s public.subastas; n integer := 0; ped bigint;
begin
  update subastas set estado = 'activa' where estado = 'proxima' and now() >= abre_en;
  for s in select * from subastas where estado = 'activa' and now() >= cierra_en for update skip locked loop
    ped := null;
    if s.lider_id is not null then
      insert into pedidos (cliente_id, canal, total, metodo_pago) values (s.lider_id, 'subasta', s.puja_actual, 'pendiente')
      returning id into ped;
    end if;
    update subastas set estado = 'cerrada', ganador_id = s.lider_id, pedido_id = ped where id = s.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Vista pública de pujas sin datos personales (nombre corto del postor).
create or replace view public.pujas_publicas with (security_invoker = false) as
  select p.id, p.subasta_id, p.monto, p.creado_en, p.postor_id,
         split_part(pf.nombre, ' ', 1) || coalesce(' ' || left(split_part(pf.nombre, ' ', 2), 1) || '.', '') as postor
  from public.pujas p join public.perfiles pf on pf.id = p.postor_id;

-- ---------- Avisos de subasta (próximas) ----------
create table public.avisos_subasta (
  subasta_id bigint references public.subastas (id) on delete cascade,
  cliente_id uuid references public.perfiles (id) on delete cascade default auth.uid(),
  primary key (subasta_id, cliente_id)
);

-- ---------- Contacto (sin cuenta) ----------
create table public.mensajes (
  id        bigint generated always as identity primary key,
  nombre    text not null, email text not null, telefono text,
  motivo    text not null, mensaje text not null,
  leido     boolean not null default false,
  creado_en timestamptz not null default now()
);

-- =====================================================================
-- Seguridad por filas
-- =====================================================================
alter table public.productos       enable row level security;
alter table public.pedidos         enable row level security;
alter table public.pedido_items    enable row level security;
alter table public.suscripciones   enable row level security;
alter table public.subastas        enable row level security;
alter table public.pujas           enable row level security;
alter table public.avisos_subasta  enable row level security;
alter table public.mensajes        enable row level security;

-- Catálogo: todos lo ven; solo el admin lo edita.
create policy "catálogo público"  on public.productos for select using (activo or public.es_equipo());
create policy "admin edita catálogo" on public.productos for all using (public.es_admin()) with check (public.es_admin());

-- Pedidos: el cliente ve los suyos; el equipo ve todos. Se crean con confirmar_pedido().
create policy "ver pedidos" on public.pedidos for select using (cliente_id = auth.uid() or public.es_equipo());
create policy "equipo actualiza estado" on public.pedidos for update using (public.es_equipo());
create policy "ver items" on public.pedido_items for select
  using (exists (select 1 from public.pedidos p where p.id = pedido_id and (p.cliente_id = auth.uid() or public.es_equipo())));

-- Club: cada uno gestiona la suya.
create policy "mi suscripción" on public.suscripciones for all
  using (cliente_id = auth.uid() or public.es_admin()) with check (cliente_id = auth.uid());

-- Subastas: todos las ven; solo el admin publica o edita (RF-10). Las pujas van por realizar_puja().
create policy "subastas públicas" on public.subastas for select using (true);
create policy "admin publica subastas" on public.subastas for all using (public.es_admin()) with check (public.es_admin());
create policy "mis pujas o equipo" on public.pujas for select using (postor_id = auth.uid() or public.es_equipo());
grant select on public.pujas_publicas to anon, authenticated;

create policy "mis avisos" on public.avisos_subasta for all using (cliente_id = auth.uid()) with check (cliente_id = auth.uid());

-- Contacto: cualquiera escribe; solo el equipo lee.
create policy "cualquiera escribe" on public.mensajes for insert with check (true);
create policy "equipo lee mensajes" on public.mensajes for select using (public.es_equipo());
create policy "equipo marca leído" on public.mensajes for update using (public.es_equipo());

-- Tiempo real para que todos vean las pujas al instante (RNF-02).
alter publication supabase_realtime add table public.subastas;
