-- =====================================================================
-- Grano y Aroma · 009 · Fotos subidas, pago con comprobante y seguimiento
-- =====================================================================
-- 1. Storage: carpeta pública "fotos" (productos y subastas, solo el admin sube) y carpeta
--    privada "comprobantes" (cada cliente sube los suyos; el equipo los revisa).
-- 2. Pedidos: estado del pago, comprobante, nota del equipo y hora de cada cambio de estado.
-- 3. Reglas: un pedido pagado por QR no pasa a preparación hasta que el equipo aprueba el
--    comprobante; el cliente puede cancelar mientras esté "Recibido" y el stock vuelve.
-- Se puede ejecutar más de una vez.

-- ---------- 1. Storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprobantes', 'comprobantes', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Fotos: cualquiera las ve (carpeta pública); solo el admin sube, cambia o borra.
drop policy if exists "admin sube fotos" on storage.objects;
drop policy if exists "admin cambia fotos" on storage.objects;
drop policy if exists "admin borra fotos" on storage.objects;
create policy "admin sube fotos" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and public.es_admin());
create policy "admin cambia fotos" on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and public.es_admin());
create policy "admin borra fotos" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and public.es_admin());

-- Comprobantes: ruta "<id del cliente>/<pedido>-<hora>.webp". El cliente solo escribe y lee en
-- su carpeta; el equipo lee todos.
drop policy if exists "cliente sube su comprobante" on storage.objects;
drop policy if exists "ver comprobantes" on storage.objects;
create policy "cliente sube su comprobante" on storage.objects for insert to authenticated
  with check (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "ver comprobantes" on storage.objects for select to authenticated
  using (bucket_id = 'comprobantes' and ((storage.foldername(name))[1] = auth.uid()::text or public.es_equipo()));

-- ---------- 2. Pedidos ----------
-- pago_estado: no_aplica (caja, subasta y pedidos viejos) · pendiente (QR sin comprobante) ·
-- por_verificar (comprobante enviado) · aprobado · rechazado (el cliente puede reenviar).
alter table public.pedidos add column if not exists pago_estado text not null default 'no_aplica';
alter table public.pedidos drop constraint if exists pedidos_pago_estado_check;
alter table public.pedidos add constraint pedidos_pago_estado_check
  check (pago_estado in ('no_aplica', 'pendiente', 'por_verificar', 'aprobado', 'rechazado'));
alter table public.pedidos add column if not exists comprobante text;      -- ruta en el bucket comprobantes
alter table public.pedidos add column if not exists pago_nota text;        -- motivo si se rechaza
alter table public.pedidos add column if not exists preparacion_en timestamptz;
alter table public.pedidos add column if not exists en_camino_en timestamptz;
alter table public.pedidos add column if not exists entregado_en timestamptz;
alter table public.pedidos add column if not exists cancelado_en timestamptz;

-- Al crear un pedido web: QR queda esperando el comprobante; tarjeta se da por aprobada
-- (la pasarela de tarjeta es simulada).
create or replace function public.pedido_pago_inicial()
returns trigger language plpgsql set search_path = public
as $$
begin
  if new.canal = 'web' then
    new.pago_estado := case when new.metodo_pago = 'qr' then 'pendiente' else 'aprobado' end;
  end if;
  return new;
end;
$$;
drop trigger if exists pedido_pago_inicial on public.pedidos;
create trigger pedido_pago_inicial before insert on public.pedidos
  for each row execute function public.pedido_pago_inicial();

-- Cada cambio de estado guarda su hora (línea de tiempo en Mi cuenta) y, si el pago no está
-- aprobado, no deja pasar de "Recibido".
create or replace function public.pedido_cambio_estado()
returns trigger language plpgsql set search_path = public
as $$
begin
  if new.estado is distinct from old.estado then
    if old.estado = 'recibido' and new.estado in ('preparacion', 'en_camino', 'entregado')
       and new.pago_estado in ('pendiente', 'por_verificar', 'rechazado') then
      raise exception 'El pago de este pedido todavía no está aprobado';
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

-- ---------- 3. Funciones ----------
-- El cliente envía (o reenvía) el comprobante de su pedido.
create or replace function public.enviar_comprobante(p_pedido bigint, p_ruta text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  if split_part(p_ruta, '/', 1) <> auth.uid()::text then raise exception 'Ruta de comprobante no válida'; end if;
  update pedidos set comprobante = p_ruta, pago_estado = 'por_verificar', pago_nota = null
   where id = p_pedido and cliente_id = auth.uid()
     and pago_estado in ('pendiente', 'rechazado') and estado <> 'cancelado';
  if not found then raise exception 'Este pedido no está esperando un comprobante'; end if;
end;
$$;

-- El equipo aprueba o rechaza el comprobante (con un motivo si lo rechaza).
create or replace function public.verificar_pago(p_pedido bigint, p_aprobado boolean, p_nota text default null)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.es_equipo() then raise exception 'Solo el equipo revisa los pagos'; end if;
  update pedidos
     set pago_estado = case when p_aprobado then 'aprobado' else 'rechazado' end,
         pago_nota = case when p_aprobado then null else nullif(trim(p_nota), '') end
   where id = p_pedido and pago_estado = 'por_verificar';
  if not found then raise exception 'Este pago ya fue revisado'; end if;
end;
$$;

-- Cancelar: el cliente (su pedido) o el equipo, solo mientras esté "Recibido". Devuelve el
-- stock y descuenta los puntos que había sumado.
create or replace function public.cancelar_pedido(p_pedido bigint)
returns void language plpgsql security definer set search_path = public
as $$
declare p public.pedidos;
begin
  select * into p from pedidos where id = p_pedido for update;
  if not found then raise exception 'No encontramos ese pedido'; end if;
  if not (p.cliente_id = auth.uid() or public.es_equipo()) then raise exception 'No puedes cancelar este pedido'; end if;
  if p.estado <> 'recibido' then raise exception 'El pedido ya está en preparación y no se puede cancelar'; end if;

  update productos pr set stock = pr.stock + i.cantidad
    from pedido_items i where i.pedido_id = p.id and pr.id = i.producto_id;
  if p.cliente_id is not null and p.canal = 'web' then
    update perfiles set puntos = greatest(0, puntos - floor(p.total / 10)::int) where id = p.cliente_id;
  end if;
  update pedidos set estado = 'cancelado' where id = p.id;
end;
$$;

-- Solo usuarios con sesión (igual que registrar_tueste en 007).
revoke all on function public.enviar_comprobante(bigint, text) from public, anon;
revoke all on function public.verificar_pago(bigint, boolean, text) from public, anon;
revoke all on function public.cancelar_pedido(bigint) from public, anon;
grant execute on function public.enviar_comprobante(bigint, text) to authenticated;
grant execute on function public.verificar_pago(bigint, boolean, text) to authenticated;
grant execute on function public.cancelar_pedido(bigint) to authenticated;
