-- =====================================================================
-- Grano y Aroma · 025 · El cliente limpia su lista de pedidos
-- =====================================================================
-- El cliente quita de "Mis pedidos" los que ya terminaron (entregados o cancelados). Solo deja de
-- verlos él: la venta sigue en la base para el panel, el Excel y el historial de puntos.
-- Ejecutar DESPUÉS de la 024. Se puede ejecutar más de una vez.

alter table public.pedidos add column if not exists oculto_cliente boolean not null default false;

create or replace function public.ocultar_pedidos(p_ids bigint[])
returns integer language plpgsql security definer set search_path = public
as $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  update pedidos set oculto_cliente = true
   where id = any(p_ids) and cliente_id = auth.uid()
     and estado in ('entregado', 'cancelado') and not oculto_cliente;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.ocultar_pedidos(bigint[]) from public, anon;
grant execute on function public.ocultar_pedidos(bigint[]) to authenticated;

select 'lista' as "025";
