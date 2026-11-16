-- =====================================================================
-- Grano y Aroma · 012 · Cuenta del repartidor y verificación de la entrega
-- =====================================================================
-- Hasta la 011 los repartidores eran solo nombres en una lista y cualquiera del equipo
-- (admin, cajero, tostador) podía "confirmar la entrega" sin haber salido de la tienda. Eso le
-- quita valor a la prueba. Ahora cada uno hace lo suyo:
--
--   1. Rol "repartidor": entra con su cuenta y ve SOLO los pedidos que le asignaron.
--   2. Solo el repartidor asignado confirma la entrega (foto, quién recibió, firma). Ni el
--      admin puede hacerlo por él: la regla vive en la base.
--   3. El admin revisa la prueba y FINALIZA la entrega, o marca que hay un problema: el
--      pedido vuelve a "En camino" con el motivo y el repartidor lo corrige.
--   4. El cliente ve "Entregado" apenas confirma el repartidor (ya tiene el café en la mano);
--      la verificación del admin es interna.
--
-- Cuando el admin le pone el rol "repartidor" a una cuenta, queda unida a la ficha de
-- repartidor con el mismo nombre; si no hay ninguna, se crea una nueva.
--
-- Aditiva: no borra tablas ni columnas. Reemplaza registrar_entrega() de la 011.
-- Ejecutar DESPUÉS de la 011. Se puede ejecutar más de una vez.
--
-- Nota técnica: un valor nuevo de un enum no se puede usar en la misma transacción en que se
-- crea, por eso aquí el rol se compara siempre como texto (mi_rol()::text = 'repartidor').

-- ---------- 1. Rol y unión cuenta ↔ repartidor ----------
alter type public.rol add value if not exists 'repartidor';

alter table public.repartidores add column if not exists perfil_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'repartidores_perfil_id_fkey') then
    alter table public.repartidores add constraint repartidores_perfil_id_fkey
      foreign key (perfil_id) references public.perfiles(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'repartidores_perfil_id_key') then
    alter table public.repartidores add constraint repartidores_perfil_id_key unique (perfil_id);
  end if;
end $$;

create or replace function public.es_repartidor()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.mi_rol()::text = 'repartidor', false) $$;

-- La ficha de repartidor de quien hace la consulta (null si no tiene).
create or replace function public.mi_repartidor()
returns bigint language sql stable security definer set search_path = public
as $$ select id from public.repartidores where perfil_id = auth.uid() and activo limit 1 $$;

-- Al darle o quitarle el rol, se une o se suelta de su ficha de repartidor.
create or replace function public.vincular_repartidor()
returns trigger language plpgsql security definer set search_path = public
as $$
declare r_id bigint;
begin
  if new.rol::text = 'repartidor' and old.rol::text is distinct from 'repartidor' then
    if exists (select 1 from repartidores where perfil_id = new.id) then
      update repartidores set activo = true where perfil_id = new.id;
    else
      -- Primero una ficha libre con el mismo nombre (por ejemplo "Carlos Mamani"); si no, una nueva.
      select id into r_id from repartidores
       where perfil_id is null and lower(trim(nombre)) = lower(trim(new.nombre))
       order by id limit 1;
      if r_id is not null then
        update repartidores set perfil_id = new.id, activo = true where id = r_id;
      else
        insert into repartidores (nombre, telefono, perfil_id)
        values (coalesce(nullif(trim(new.nombre), ''), 'Repartidor'), new.telefono, new.id);
      end if;
    end if;
  elsif old.rol::text = 'repartidor' and new.rol::text is distinct from 'repartidor' then
    -- Deja de repartir: la ficha queda (los pedidos viejos la siguen nombrando) pero inactiva.
    update repartidores set perfil_id = null, activo = false where perfil_id = new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists vincular_repartidor on public.perfiles;
create trigger vincular_repartidor after update of rol on public.perfiles
  for each row execute function public.vincular_repartidor();

-- ---------- 2. Qué ve el repartidor (y el cliente) ----------
-- El repartidor ve solo los pedidos que lleva, con sus productos, y su propia ficha.
drop policy if exists "repartidor ve sus pedidos" on public.pedidos;
create policy "repartidor ve sus pedidos" on public.pedidos for select
  using (repartidor_id is not null and repartidor_id = public.mi_repartidor());

drop policy if exists "repartidor ve items de sus pedidos" on public.pedido_items;
create policy "repartidor ve items de sus pedidos" on public.pedido_items for select
  using (exists (select 1 from public.pedidos p where p.id = pedido_id and p.repartidor_id = public.mi_repartidor()));

drop policy if exists "repartidor ve su ficha" on public.repartidores;
create policy "repartidor ve su ficha" on public.repartidores for select
  using (perfil_id = auth.uid());

-- El cliente ve quién le lleva el pedido (nombre, teléfono y vehículo) y nada más.
drop policy if exists "cliente ve a su repartidor" on public.repartidores;
create policy "cliente ve a su repartidor" on public.repartidores for select
  using (exists (select 1 from public.pedidos p where p.repartidor_id = repartidores.id and p.cliente_id = auth.uid()));

-- Fotos de entrega: ahora las sube el repartidor (y las ve, para revisar lo que mandó).
drop policy if exists "equipo sube foto de entrega" on storage.objects;
drop policy if exists "repartidor sube foto de entrega" on storage.objects;
drop policy if exists "ver fotos de entrega" on storage.objects;
create policy "repartidor sube foto de entrega" on storage.objects for insert to authenticated
  with check (bucket_id = 'entregas' and public.es_repartidor());
create policy "ver fotos de entrega" on storage.objects for select to authenticated
  using (bucket_id = 'entregas' and ((storage.foldername(name))[1] = auth.uid()::text
         or public.es_equipo() or public.es_repartidor()));

-- ---------- 3. Verificación del admin ----------
alter table public.pedidos add column if not exists entrega_verificada_por uuid;
alter table public.pedidos add column if not exists entrega_verificada_en timestamptz;
alter table public.pedidos add column if not exists entrega_observacion text;  -- motivo si el admin la devolvió
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pedidos_entrega_verificada_por_fkey') then
    alter table public.pedidos add constraint pedidos_entrega_verificada_por_fkey
      foreign key (entrega_verificada_por) references public.perfiles(id) on delete set null;
  end if;
end $$;

-- ---------- 4. Funciones ----------
-- Confirmar la entrega: SOLO el repartidor asignado, y solo cuando el pedido va en camino.
-- Misma firma que en la 011, así el frontend no cambia la llamada.
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
  if not public.es_repartidor() then raise exception 'Solo el repartidor confirma la entrega, desde su cuenta'; end if;
  if nullif(trim(coalesce(p_foto, '')), '') is null then raise exception 'Falta la foto de la entrega'; end if;
  if nullif(trim(coalesce(p_recibido_por, '')), '') is null then raise exception 'Falta el nombre de quien recibió'; end if;

  select * into p from pedidos where id = p_pedido for update;
  if not found then raise exception 'No encontramos ese pedido'; end if;
  if p.repartidor_id is distinct from public.mi_repartidor() then
    raise exception 'Este pedido lo lleva otro repartidor';
  end if;
  if p.estado = 'entregado' then raise exception 'Este pedido ya figura como entregado'; end if;
  if p.estado <> 'en_camino' then raise exception 'El pedido tiene que estar en camino para poder entregarlo'; end if;

  update pedidos
     set estado = 'entregado',
         entrega_foto = p_foto,
         entrega_recibido_por = trim(p_recibido_por),
         entrega_tipo = coalesce(nullif(trim(coalesce(p_tipo, '')), ''), 'titular'),
         entrega_nota = nullif(trim(coalesce(p_nota, '')), ''),
         entrega_firma = nullif(trim(coalesce(p_firma, '')), ''),
         entrega_registrada_por = auth.uid(),
         entrega_observacion = null
   where id = p_pedido;
end;
$$;

-- Despachar: igual que en la 011, pero solo a un repartidor CON cuenta. Sin cuenta nadie
-- podría confirmar la entrega y el pedido quedaría trabado "En camino".
create or replace function public.registrar_despacho(p_pedido bigint, p_repartidor bigint)
returns void language plpgsql security definer set search_path = public
as $$
declare p public.pedidos; r public.repartidores;
begin
  if not public.es_equipo() then raise exception 'Solo el equipo despacha pedidos'; end if;

  select * into r from repartidores where id = p_repartidor and activo;
  if not found then raise exception 'Ese repartidor no existe o está dado de baja'; end if;
  if r.perfil_id is null then
    raise exception '% no tiene cuenta todavía: dale el rol Repartidor en Usuarios', r.nombre;
  end if;

  select * into p from pedidos where id = p_pedido for update;
  if not found then raise exception 'No encontramos ese pedido'; end if;
  if p.estado <> 'preparacion' then raise exception 'El pedido tiene que estar en preparación para poder despacharlo'; end if;

  update pedidos
     set estado = 'en_camino',
         repartidor_id = r.id,
         repartidor = r.nombre,
         despachado_por = auth.uid()
   where id = p_pedido;
end;
$$;

-- El admin revisa la prueba y da la entrega por finalizada.
create or replace function public.finalizar_entrega(p_pedido bigint)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.es_admin() then raise exception 'Solo el administrador finaliza las entregas'; end if;
  update pedidos
     set entrega_verificada_por = auth.uid(), entrega_verificada_en = now()
   where id = p_pedido and estado = 'entregado' and entrega_verificada_en is null;
  if not found then raise exception 'Esta entrega no está esperando revisión'; end if;
end;
$$;

-- El admin ve un problema en la prueba (foto borrosa, otra dirección…): el pedido vuelve a
-- "En camino" con el motivo, y el repartidor lo ve en su pantalla para corregirlo.
create or replace function public.devolver_entrega(p_pedido bigint, p_motivo text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.es_admin() then raise exception 'Solo el administrador revisa las entregas'; end if;
  if nullif(trim(coalesce(p_motivo, '')), '') is null then raise exception 'Escribe qué hay que corregir'; end if;
  update pedidos
     set estado = 'en_camino',
         entrega_observacion = trim(p_motivo),
         entrega_foto = null, entrega_firma = null, entrega_recibido_por = null,
         entrega_tipo = null, entrega_nota = null, entrega_registrada_por = null, entregado_en = null
   where id = p_pedido and estado = 'entregado' and entrega_verificada_en is null;
  if not found then raise exception 'Esta entrega no está esperando revisión'; end if;
end;
$$;

revoke all on function public.registrar_entrega(bigint, text, text, text, text, text) from public, anon;
revoke all on function public.registrar_despacho(bigint, bigint) from public, anon;
grant execute on function public.registrar_despacho(bigint, bigint) to authenticated;
revoke all on function public.finalizar_entrega(bigint) from public, anon;
revoke all on function public.devolver_entrega(bigint, text) from public, anon;
grant execute on function public.registrar_entrega(bigint, text, text, text, text, text) to authenticated;
grant execute on function public.finalizar_entrega(bigint) to authenticated;
grant execute on function public.devolver_entrega(bigint, text) to authenticated;
