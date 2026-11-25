-- =====================================================================
-- Grano y Aroma · 010 · Prueba de entrega y auditoría del pago
-- =====================================================================
-- Qué resuelve, y por qué hacía falta:
--
--   Hasta la 009 marcar un pedido como "Entregado" era solo un cambio de estado. Si el
--   cliente decía que nunca le llegó, el sistema no tenía con qué responder: ni foto, ni
--   nombre de quien recibió, ni constancia de quién hizo el registro. Esto lo arregla.
--
--   1. Carpeta privada "entregas": la foto que toma el repartidor al dejar el pedido.
--   2. Columnas de la prueba: foto, quién recibió, en qué calidad y la nota del repartidor.
--   3. registrar_entrega(): la ÚNICA vía para marcar un pedido como entregado. Exige foto y
--      nombre de quien recibió, así que no se puede cerrar un pedido sin evidencia.
--   4. Auditoría del pago: quién aprobó o rechazó el comprobante y a qué hora.
--
-- Esta migración es ADITIVA: no borra ni cambia tablas, columnas ni políticas anteriores.
-- Reemplaza dos funciones de la 009 (pedido_cambio_estado y verificar_pago) conservando
-- todo lo que ya hacían y sumándoles lo nuevo.
-- Se puede ejecutar más de una vez.

-- ---------- 1. Carpeta de fotos de entrega ----------
-- Privada: una foto de entrega muestra la puerta de la casa de alguien. No es material
-- público, aunque el pedido sí sea del propio cliente.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('entregas', 'entregas', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Ruta: "<id del cliente>/<pedido>-<hora>.webp". Sube el equipo (es quien entrega);
-- la lee el equipo y el cliente dueño de esa carpeta.
-- Los pedidos sin cuenta (comprados como invitado) van a la carpeta "sin-cliente", que solo
-- ve el equipo: no hay a quién mostrársela.
drop policy if exists "equipo sube foto de entrega" on storage.objects;
drop policy if exists "ver fotos de entrega" on storage.objects;
create policy "equipo sube foto de entrega" on storage.objects for insert to authenticated
  with check (bucket_id = 'entregas' and public.es_equipo());
create policy "ver fotos de entrega" on storage.objects for select to authenticated
  using (bucket_id = 'entregas' and ((storage.foldername(name))[1] = auth.uid()::text or public.es_equipo()));

-- ---------- 2. Columnas de la prueba de entrega ----------
alter table public.pedidos add column if not exists entrega_foto text;          -- ruta en el bucket entregas
alter table public.pedidos add column if not exists entrega_recibido_por text;  -- nombre de quien recibió
alter table public.pedidos add column if not exists entrega_tipo text;          -- en qué calidad recibió
alter table public.pedidos add column if not exists entrega_nota text;          -- "lo dejé con el portero del edificio"
alter table public.pedidos add column if not exists entrega_registrada_por uuid;

alter table public.pedidos drop constraint if exists pedidos_entrega_tipo_check;
alter table public.pedidos add constraint pedidos_entrega_tipo_check
  check (entrega_tipo is null or entrega_tipo in ('titular', 'familiar', 'portero', 'vecino', 'otro'));

-- Auditoría del pago: la 009 guardaba el resultado pero no quién lo decidió.
alter table public.pedidos add column if not exists pago_revisado_por uuid;
alter table public.pedidos add column if not exists pago_revisado_en timestamptz;

-- Las claves foráneas van aparte y con nombre fijo, por dos razones:
--  · "add column if not exists ... references ..." no crea la clave si la columna ya existía
--    de una corrida anterior, y la migración quedaría a medias sin avisar.
--  · El panel trae el nombre de quien revisó en la misma consulta
--    (perfiles!pedidos_pago_revisado_por_fkey), y para eso el nombre tiene que ser estable.
-- Apuntan a perfiles y no a auth.users porque PostgREST solo sigue las claves foráneas
-- entre tablas del esquema public.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pedidos_pago_revisado_por_fkey') then
    alter table public.pedidos add constraint pedidos_pago_revisado_por_fkey
      foreign key (pago_revisado_por) references public.perfiles(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pedidos_entrega_registrada_por_fkey') then
    alter table public.pedidos add constraint pedidos_entrega_registrada_por_fkey
      foreign key (entrega_registrada_por) references public.perfiles(id) on delete set null;
  end if;
end $$;

-- ---------- 3. Reglas de estado ----------
-- Reemplaza la función de la 009 conservando sus dos reglas (sellar la hora de cada cambio y
-- no dejar avanzar sin pago aprobado) y agregando la tercera: no se entrega sin evidencia.
create or replace function public.pedido_cambio_estado()
returns trigger language plpgsql set search_path = public
as $$
begin
  if new.estado is distinct from old.estado then
    -- Regla de la 009: el pago manda.
    if old.estado = 'recibido' and new.estado in ('preparacion', 'en_camino', 'entregado')
       and new.pago_estado in ('pendiente', 'por_verificar', 'rechazado') then
      raise exception 'El pago de este pedido todavía no está aprobado';
    end if;

    -- Nueva: "entregado" exige prueba. Como registrar_entrega() escribe la foto y el nombre
    -- en el mismo UPDATE que el estado, la función pasa y un update suelto no.
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

-- ---------- 4. Funciones ----------
-- El repartidor cierra la entrega. Es la única vía: deja la prueba y el estado en un solo
-- UPDATE, de modo que nunca existe un pedido entregado sin evidencia.
create or replace function public.registrar_entrega(
  p_pedido bigint,
  p_foto text,
  p_recibido_por text,
  p_tipo text default 'titular',
  p_nota text default null
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
         entrega_registrada_por = auth.uid()
   where id = p_pedido;
end;
$$;

-- Igual que en la 009, pero dejando constancia de quién revisó y cuándo.
create or replace function public.verificar_pago(p_pedido bigint, p_aprobado boolean, p_nota text default null)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.es_equipo() then raise exception 'Solo el equipo revisa los pagos'; end if;
  update pedidos
     set pago_estado = case when p_aprobado then 'aprobado' else 'rechazado' end,
         pago_nota = case when p_aprobado then null else nullif(trim(p_nota), '') end,
         pago_revisado_por = auth.uid(),
         pago_revisado_en = now()
   where id = p_pedido and pago_estado = 'por_verificar';
  if not found then raise exception 'Este pago ya fue revisado'; end if;
end;
$$;

revoke all on function public.registrar_entrega(bigint, text, text, text, text) from public, anon;
grant execute on function public.registrar_entrega(bigint, text, text, text, text) to authenticated;
