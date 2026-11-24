-- =====================================================================
-- Grano y Aroma · 019 · El cobro del Club se confirma solo (sin el admin)
-- =====================================================================
-- La 014b (cobros del Club) dejó el precio en la base y un cobro por cada envío, pero el pago
-- esperaba a que el equipo mirara un comprobante. Pedido del docente: los pagos se validan
-- automáticamente y el admin solo supervisa. Igual que pagar_qr() de la 013 con los pedidos:
--
--   · pagar_cobro_club(): el cliente paga, toca "Ya pagué" y el "banco" (simulado) lo confirma.
--   · Cambiar el plan, saltar un envío o pausar ya no deja cobros colgados: el cobro sin pagar
--     del envío anterior se borra y, si ese envío ya estaba pagado, el pago pasa al nuevo.
--   · generar_cobros_club() avanza sola los envíos ya pagados.
--   · Las suscripciones anteriores a la 014b reciben su cobro, y los comprobantes que quedaron
--     esperando revisión se dan por pagados.
--
-- Ejecutar DESPUÉS de la 014b y la 015. No borra suscripciones. Se puede ejecutar más de una vez.

-- ---------- 1. Pagar el envío ----------
create or replace function public.pagar_cobro_club(p_cobro bigint)
returns void language plpgsql security definer set search_path = public
as $$
declare c public.cobros_club; s public.suscripciones;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  select * into c from cobros_club where id = p_cobro and cliente_id = auth.uid() for update;
  if not found then raise exception 'No encontramos ese cobro'; end if;
  if c.estado = 'aprobado' then raise exception 'Ese envío ya está pagado'; end if;

  select * into s from suscripciones where id = c.suscripcion_id for update;
  if s.estado = 'cancelada' then raise exception 'Esa suscripción está cancelada'; end if;

  -- verificado_por queda vacío: lo aprobó el sistema (el banco), no una persona.
  update cobros_club
     set estado = 'aprobado', nota = null, verificado_en = now(), verificado_por = null
   where id = c.id;
  update suscripciones
     set pago_estado = 'aprobado', proximo_envio = greatest(c.periodo, current_date) + s.frecuencia
   where id = s.id;
end;
$$;

-- ---------- 2. Guardar sin dejar cobros colgados ----------
-- La misma función de la 014b; cambia solo la parte del cobro, al final.
create or replace function public.guardar_suscripcion(
  p_frecuencia integer,
  p_gramos integer,
  p_cafe text,
  p_molienda text,
  p_inicio date default null,
  p_saltos integer default 0,
  p_pausa_hasta date default null,
  p_estado text default 'activa',
  p_proximo_envio date default null
) returns public.suscripciones
language plpgsql security definer set search_path = public
as $$
declare
  v_precio numeric;
  v_inicio date := coalesce(p_inicio, current_date + 3);
  v_prox   date := coalesce(p_proximo_envio, coalesce(p_inicio, current_date + 3));
  v_pagado bigint;
  actual   public.suscripciones;
  nueva    public.suscripciones;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  if p_frecuencia not in (15, 30) then raise exception 'La frecuencia solo puede ser cada 15 o 30 días'; end if;
  if p_gramos not in (250, 500, 1000) then raise exception 'La cantidad solo puede ser 250 g, 500 g o 1 kg'; end if;
  if p_estado not in ('activa', 'pausada') then raise exception 'Estado de suscripción no válido'; end if;

  -- El precio NO llega del cliente: se calcula con las reglas del negocio.
  v_precio := public.precio_club(p_cafe, p_gramos, p_frecuencia);

  select * into actual from suscripciones
   where cliente_id = auth.uid() and estado <> 'cancelada' for update;

  if found then
    update suscripciones
       set frecuencia = p_frecuencia, gramos = p_gramos, cafe = p_cafe, molienda = p_molienda,
           precio = v_precio, estado = p_estado::public.estado_sub, inicio = v_inicio,
           saltos = coalesce(p_saltos, 0), pausa_hasta = p_pausa_hasta, proximo_envio = v_prox
     where id = actual.id
    returning * into nueva;
  else
    insert into suscripciones (cliente_id, frecuencia, gramos, cafe, molienda, precio,
                               estado, inicio, saltos, pausa_hasta, proximo_envio)
    values (auth.uid(), p_frecuencia, p_gramos, p_cafe, p_molienda, v_precio,
            p_estado::public.estado_sub, v_inicio, coalesce(p_saltos, 0), p_pausa_hasta, v_prox)
    returning * into nueva;
  end if;

  -- Cobros sin pagar de otro envío (porque lo saltó, lo pausó o venció): ya no corresponden.
  delete from cobros_club
   where suscripcion_id = nueva.id and estado <> 'aprobado' and periodo <> v_prox;

  -- Un envío futuro ya pagado que se movió de fecha: el pago se va con él, no se cobra dos veces.
  select id into v_pagado from cobros_club
   where suscripcion_id = nueva.id and estado = 'aprobado' and periodo >= current_date and periodo <> v_prox
   order by periodo limit 1;
  if v_pagado is not null
     and not exists (select 1 from cobros_club where suscripcion_id = nueva.id and periodo = v_prox and estado = 'aprobado') then
    delete from cobros_club where suscripcion_id = nueva.id and periodo = v_prox;
    update cobros_club set periodo = v_prox where id = v_pagado;
  end if;

  -- Cobro del próximo envío. Si cambia de plan antes de pagar, se corrige el monto; si ya lo
  -- pagó, no se toca. En pausa no se cobra nada.
  if p_estado = 'activa' then
    insert into cobros_club (suscripcion_id, cliente_id, periodo, monto)
    values (nueva.id, nueva.cliente_id, v_prox, v_precio)
    on conflict (suscripcion_id, periodo) do update
      set monto = excluded.monto
    where cobros_club.estado <> 'aprobado';
  else
    delete from cobros_club where suscripcion_id = nueva.id and estado <> 'aprobado';
  end if;

  update suscripciones s
     set pago_estado = case
           when exists (select 1 from cobros_club c where c.suscripcion_id = s.id and c.estado <> 'aprobado') then 'pendiente'
           when exists (select 1 from cobros_club c where c.suscripcion_id = s.id and c.estado = 'aprobado') then 'aprobado'
           else 'pendiente' end
   where s.id = nueva.id
  returning * into nueva;

  return nueva;
end;
$$;

-- ---------- 3. Lo recurrente ----------
create or replace function public.generar_cobros_club()
returns integer language plpgsql security definer set search_path = public
as $$
declare n integer := 0;
begin
  -- El próximo envío ya está pagado: se pasa al siguiente.
  update suscripciones s set proximo_envio = s.proximo_envio + s.frecuencia
   where s.estado = 'activa'
     and exists (select 1 from cobros_club c
                  where c.suscripcion_id = s.id and c.periodo = s.proximo_envio and c.estado = 'aprobado');

  insert into cobros_club (suscripcion_id, cliente_id, periodo, monto)
  select s.id, s.cliente_id, s.proximo_envio, public.precio_club(s.cafe, s.gramos, s.frecuencia)
    from suscripciones s
   where s.estado = 'activa'
     and s.proximo_envio <= current_date + 3
     and (s.pausa_hasta is null or s.pausa_hasta <= current_date)
     and not exists (select 1 from cobros_club c where c.suscripcion_id = s.id and c.estado <> 'aprobado')
  on conflict (suscripcion_id, periodo) do nothing;
  get diagnostics n = row_count;

  update suscripciones s set pago_estado = 'pendiente'
    from cobros_club c
   where c.suscripcion_id = s.id and c.estado = 'pendiente' and s.pago_estado = 'aprobado';

  return n;
end;
$$;

-- ---------- 4. Poner al día lo que ya existía ----------
update public.suscripciones s
   set pago_estado = 'aprobado', proximo_envio = greatest(c.periodo, current_date) + s.frecuencia
  from public.cobros_club c
 where c.suscripcion_id = s.id and c.estado = 'por_verificar' and s.estado <> 'cancelada';

update public.cobros_club
   set estado = 'aprobado', nota = null, verificado_en = coalesce(verificado_en, now())
 where estado = 'por_verificar';

-- Suscripciones activas de antes de la 014b: nunca tuvieron un cobro.
insert into public.cobros_club (suscripcion_id, cliente_id, periodo, monto)
select s.id, s.cliente_id, greatest(coalesce(s.proximo_envio, current_date + 3), current_date),
       public.precio_club(s.cafe, s.gramos, s.frecuencia)
  from public.suscripciones s
 where s.estado = 'activa'
   and not exists (select 1 from public.cobros_club c where c.suscripcion_id = s.id)
on conflict (suscripcion_id, periodo) do nothing;

-- ---------- 5. Permisos y tiempo real ----------
revoke all on function public.pagar_cobro_club(bigint) from public, anon;
grant execute on function public.pagar_cobro_club(bigint) to authenticated;
revoke all on function public.guardar_suscripcion(integer, integer, text, text, date, integer, date, text, date) from public, anon;
grant execute on function public.guardar_suscripcion(integer, integer, text, text, date, integer, date, text, date) to authenticated;

-- El trabajo diario lo corre la base, no una persona.
revoke all on function public.generar_cobros_club() from public, anon, authenticated;

-- Ya nadie revisa comprobantes del Club: la web no usa estas dos.
revoke all on function public.enviar_comprobante_club(bigint, text) from public, anon, authenticated;
revoke all on function public.verificar_cobro_club(bigint, boolean, text) from public, anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.cobros_club;
exception when duplicate_object then null;
end $$;
