-- =====================================================================
-- Grano y Aroma · 001 · Usuarios y roles
-- Roles: cliente, cajero, tostador, admin (RF-34).
-- Cada usuario de Supabase Auth tiene un perfil con su rol. Al registrarse
-- desde la web queda como "cliente"; el admin cambia los roles.
-- =====================================================================

create type public.rol as enum ('cliente', 'cajero', 'tostador', 'admin');

create table public.perfiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  nombre      text not null default '',
  telefono    text,
  direccion   text,
  rol         public.rol not null default 'cliente',
  puntos      integer not null default 0 check (puntos >= 0),   -- fidelización (RF-32)
  creado_en   timestamptz not null default now()
);

comment on table public.perfiles is 'Datos y rol de cada usuario (1 a 1 con auth.users).';

-- Rol del usuario que hace la consulta. SECURITY DEFINER para poder usarlo
-- dentro de las políticas de perfiles sin recursión.
create or replace function public.mi_rol()
returns public.rol
language sql stable security definer set search_path = public
as $$
  select rol from public.perfiles where id = auth.uid();
$$;

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.mi_rol() = 'admin', false); $$;

create or replace function public.es_equipo()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.mi_rol() in ('cajero', 'tostador', 'admin'), false); $$;

-- Crear el perfil automáticamente al registrarse (el nombre viene del formulario).
create or replace function public.crear_perfil()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger al_registrarse
  after insert on auth.users
  for each row execute function public.crear_perfil();

-- Nadie puede cambiarse el rol a sí mismo (solo el admin cambia roles).
create or replace function public.proteger_rol()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.rol is distinct from old.rol and not public.es_admin() then
    raise exception 'Solo un administrador puede cambiar roles';
  end if;
  if new.puntos is distinct from old.puntos and not public.es_equipo() and current_user <> 'postgres' then
    raise exception 'Los puntos solo los asigna el sistema';
  end if;
  return new;
end;
$$;

create trigger proteger_rol before update on public.perfiles
  for each row execute function public.proteger_rol();

-- ---------- Seguridad por filas (RLS) ----------
alter table public.perfiles enable row level security;

create policy "cada uno ve su perfil; el equipo ve todos"
  on public.perfiles for select
  using (id = auth.uid() or public.es_equipo());

create policy "cada uno edita su perfil; el admin cualquiera"
  on public.perfiles for update
  using (id = auth.uid() or public.es_admin());
