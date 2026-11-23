-- =====================================================================
-- Grano y Aroma · 013 · Pagos validados automáticamente (sin el admin)
-- =====================================================================
-- Pedido del docente: el admin no debe intervenir para que un pedido avance; el sistema valida
-- solo y cada rol hace su parte. Hasta la 012 el pago por QR quedaba "pendiente" hasta que el
-- cliente subía un comprobante y el admin lo aprobaba a mano.
--
-- Ahora:
--   · Tarjeta: el "banco" aprueba en el momento (ya era así: pedido_pago_inicial de la 009).
--   · QR: el cliente paga y toca "Ya pagué"; pagar_qr() deja el pago aprobado al instante,
--     como haría el aviso automático del banco (webhook) en un sistema real. Aquí es una
--     simulación: no hay banco de por medio.
--   · Los pedidos QR que quedaron esperando revisión se dan por pagados (nadie los va a revisar).
--
-- verificar_pago() de la 010 se mantiene por compatibilidad, pero la web ya no la usa.
-- Ejecutar DESPUÉS de la 012. Se puede ejecutar más de una vez.

create or replace function public.pagar_qr(p_pedido bigint)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  update pedidos
     set pago_estado = 'aprobado',
         pago_nota = null,
         pago_revisado_en = now(),
         pago_revisado_por = null   -- lo aprobó el sistema (el banco), no una persona
   where id = p_pedido
     and cliente_id = auth.uid()
     and metodo_pago = 'qr'
     and pago_estado in ('pendiente', 'por_verificar', 'rechazado')
     and estado <> 'cancelado';
  if not found then raise exception 'Este pedido no está esperando un pago'; end if;
end;
$$;

revoke all on function public.pagar_qr(bigint) from public, anon;
grant execute on function public.pagar_qr(bigint) to authenticated;

-- Comprobantes que quedaron esperando la revisión del admin: ya no hay quién los revise.
update public.pedidos
   set pago_estado = 'aprobado', pago_revisado_en = coalesce(pago_revisado_en, now())
 where pago_estado = 'por_verificar' and estado <> 'cancelado';
