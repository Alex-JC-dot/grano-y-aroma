-- =====================================================================
-- Grano y Aroma · 021 · El pago se confirma al escanear el QR
-- =====================================================================
-- Hasta ahora el cliente pagaba y tocaba "Ya pagué". Ahora no toca nada: el QR lleva un enlace
-- con un código secreto y, al escanearlo con el celular, la página /pagar avisa a la base (como
-- el aviso automático del banco en un sistema real). La pantalla de la compra, que está
-- escuchando, pasa sola a "¡Pago exitoso!".
--
--   · Cada pedido y cada cobro del Club recibe su código de pago (uuid al azar, imposible de
--     adivinar). Solo lo ven el dueño y el equipo, por las reglas RLS de siempre.
--   · pagar_con_qr(código): la llama el celular que escanea, sin necesidad de iniciar sesión.
--     El monto NO viaja en el QR: lo pone la base. Escanear dos veces no paga dos veces.
--
-- Sigue siendo una simulación: no hay banco ni dinero real.
-- Ejecutar DESPUÉS de la 020. No cambia pedidos existentes. Se puede ejecutar más de una vez.

alter table public.pedidos     add column if not exists pago_token uuid not null default gen_random_uuid();
alter table public.cobros_club add column if not exists pago_token uuid not null default gen_random_uuid();
create unique index if not exists pedidos_pago_token     on public.pedidos (pago_token);
create unique index if not exists cobros_club_pago_token on public.cobros_club (pago_token);

create or replace function public.pagar_con_qr(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare p public.pedidos; c public.cobros_club; s public.suscripciones;
begin
  -- Un pedido de la tienda
  select * into p from pedidos where pago_token = p_token for update;
  if found then
    if p.estado = 'cancelado' then raise exception 'Este pedido se canceló'; end if;
    if p.metodo_pago is distinct from 'qr' or p.pago_estado = 'no_aplica' then
      raise exception 'Este pedido no se paga con QR';
    end if;
    if p.pago_estado = 'aprobado' then
      return jsonb_build_object('concepto', 'Pedido ' || p.codigo, 'total', p.total, 'repetido', true);
    end if;
    update pedidos
       set pago_estado = 'aprobado', pago_nota = null, pago_revisado_en = now(),
           pago_revisado_por = null   -- lo aprobó el sistema (el banco), no una persona
     where id = p.id;
    return jsonb_build_object('concepto', 'Pedido ' || p.codigo, 'total', p.total, 'repetido', false);
  end if;

  -- Un envío del Club
  select * into c from cobros_club where pago_token = p_token for update;
  if not found then raise exception 'Este código de pago no existe o ya no sirve'; end if;
  select * into s from suscripciones where id = c.suscripcion_id for update;
  if c.estado = 'aprobado' then
    return jsonb_build_object('concepto', 'Club Grano y Aroma', 'total', c.monto, 'repetido', true);
  end if;
  if s.estado = 'cancelada' then raise exception 'Esa suscripción está cancelada'; end if;
  update cobros_club
     set estado = 'aprobado', nota = null, verificado_en = now(), verificado_por = null
   where id = c.id;
  update suscripciones
     set pago_estado = 'aprobado', proximo_envio = greatest(c.periodo, current_date) + s.frecuencia
   where id = s.id;
  return jsonb_build_object('concepto', 'Club Grano y Aroma', 'total', c.monto, 'repetido', false);
end;
$$;

revoke all on function public.pagar_con_qr(uuid) from public;
grant execute on function public.pagar_con_qr(uuid) to anon, authenticated;
