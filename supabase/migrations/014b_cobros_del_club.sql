-- =====================================================================
-- Grano y Aroma · 014b · Cobro del Club con verificación de pago (RF-07)
-- =====================================================================
-- El Club tenía dos huecos, y el segundo era el grave:
--
--   1. Nadie pagaba nada. Se elegía el plan, la fila quedaba 'activa' y la pantalla mostraba
--      "cobro de Bs. 216 el viernes", pero ese cobro no existía en ninguna parte. El RF-07
--      pide cobro recurrente; sin un registro de cobro no hay nada que cobrar ni que auditar.
--
--   2. El precio lo ponía el navegador. Club.tsx calculaba `precios(...).club` en JavaScript y
--      lo insertaba directo en la tabla; la única regla era que la fila fuera tuya. Es decir:
--      cualquiera con la consola abierta podía suscribirse por Bs. 0 y el sistema lo daba por
--      bueno. Es el mismo error que la 013 corrigió en los puntos: tratar como dato de
--      confianza algo que manda el cliente.
--
-- Qué hace esta migración:
--   · El precio se calcula en la base (precio_club) con las mismas reglas que la pantalla.
--   · El navegador deja de poder escribir en `suscripciones`: solo puede leerla. Toda alta o
--     cambio pasa por guardar_suscripcion(), que es quien decide el precio.
--   · Cada envío genera un cobro con su comprobante y su verificación, igual que los pedidos
--     (misma jerga: pendiente → por_verificar → aprobado / rechazado).
--   · Un trabajo diario genera los cobros de los envíos que se vienen: eso es lo recurrente.
--
-- Aditiva: no borra datos. Ejecutar DESPUÉS de la 013b. Si se repite, ejecutar después la 019.

-- ---------- 1. El precio, en la base ----------
-- Espejo exacto de precios() en src/components/club/Club.tsx: el precio de la bolsa de 250 g
-- escalado a los gramos del envío, menos el descuento del Club. Si alguna vez las dos versiones
-- no coincidieran, manda esta: es la que se guarda.
create or replace function public.precio_club(p_cafe text, p_gramos integer, p_frecuencia integer)
returns numeric language sql stable set search_path = public
as $$
  select round(
    coalesce(
      case when p_cafe = 'sorpresa' then 120::numeric
           else (select precio from productos where id = p_cafe and activo) end,
      120::numeric                                   -- café borrado o inexistente: el de sorpresa
    )
    * (greatest(p_gramos, 0)::numeric / 250)
    * (1 - case when p_frecuencia = 15 then 0.15 else 0.10 end)
  );
$$;

-- ---------- 2. Los cobros ----------
create table if not exists public.cobros_club (
  id             bigint generated always as identity primary key,
  suscripcion_id bigint not null references public.suscripciones(id) on delete cascade,
  cliente_id     uuid   not null references public.perfiles(id) on delete cascade,
  periodo        date   not null,                    -- el envío que este cobro paga
  monto          numeric(10,2) not null,
  estado         text   not null default 'pendiente',
  comprobante    text,                               -- ruta en el bucket privado "comprobantes"
  nota           text,                               -- por qué el equipo lo rechazó
  verificado_por uuid references public.perfiles(id),
  verificado_en  timestamptz,
  creado_en      timestamptz not null default now()
);

alter table public.cobros_club drop constraint if exists cobros_club_estado_check;
alter table public.cobros_club add constraint cobros_club_estado_check
  check (estado in ('pendiente', 'por_verificar', 'aprobado', 'rechazado'));

-- Un cobro por envío: evita cobrar dos veces el mismo si el trabajo diario corre dos veces.
create unique index if not exists cobro_club_periodo on public.cobros_club (suscripcion_id, periodo);
create index if not exists cobros_club_pendientes on public.cobros_club (estado, creado_en desc);

alter table public.cobros_club enable row level security;
drop policy if exists "cliente ve sus cobros" on public.cobros_club;
create policy "cliente ve sus cobros" on public.cobros_club for select
  using (cliente_id = auth.uid() or public.es_equipo());

-- Solo lectura: los cobros los crean y los cambian las funciones de abajo, que son
-- security definer. Nadie escribe aquí a mano desde el navegador.
grant select on public.cobros_club to authenticated;
revoke insert, update, delete on public.cobros_club from authenticated, anon;

-- Estado del pago a la vista en la suscripción, para no tener que cruzar tablas en cada consulta.
alter table public.suscripciones add column if not exists pago_estado text not null default 'pendiente';
alter table public.suscripciones drop constraint if exists suscripciones_pago_estado_check;
alter table public.suscripciones add constraint suscripciones_pago_estado_check
  check (pago_estado in ('pendiente', 'por_verificar', 'aprobado', 'rechazado'));

-- ---------- 3. Cerrar la puerta ----------
-- Esta es la corrección de fondo. Antes la política era "for all": el cliente podía insertar y
-- actualizar su propia fila con los valores que quisiera, precio incluido. Ahora solo puede
-- leerla; para crearla o cambiarla tiene que pasar por guardar_suscripcion().
drop policy if exists "mi suscripción" on public.suscripciones;
create policy "mi suscripción" on public.suscripciones for select
  using (cliente_id = auth.uid() or public.es_equipo());

revoke insert, update, delete on public.suscripciones from authenticated, anon;
grant select on public.suscripciones to authenticated;

-- ---------- 4. Alta y cambios de la suscripción ----------
-- Recibe lo que el cliente eligió (plan, café, molienda, fechas) pero NO el precio: ese lo
-- calcula aquí. El estado se limita a activa o pausada; cancelar tiene su propia función para
-- que no se pueda "cancelar" sin querer al guardar un cambio.
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

  -- Cobro del próximo envío. Si el cliente cambia de plan antes de pagar, se corrige el monto;
  -- si ya lo pagó, no se toca: un cobro aprobado es un hecho, no un borrador.
  insert into cobros_club (suscripcion_id, cliente_id, periodo, monto)
  values (nueva.id, nueva.cliente_id, nueva.proximo_envio, v_precio)
  on conflict (suscripcion_id, periodo) do update
    set monto = excluded.monto
  where cobros_club.estado in ('pendiente', 'rechazado');

  return nueva;
end;
$$;

create or replace function public.cancelar_suscripcion()
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  update suscripciones set estado = 'cancelada'
   where cliente_id = auth.uid() and estado <> 'cancelada';
  -- Los cobros que nadie pagó dejan de tener sentido; los pagados quedan como historial.
  delete from cobros_club c
   using suscripciones s
   where c.suscripcion_id = s.id and s.cliente_id = auth.uid() and c.estado = 'pendiente';
end;
$$;

-- ---------- 5. Comprobante y verificación ----------
-- Mismo recorrido que un pedido pagado por QR (migración 009): el cliente sube la captura de la
-- transferencia y el equipo la mira y decide. Sin esto, "pagado" sería una palabra sin respaldo.
create or replace function public.enviar_comprobante_club(p_cobro bigint, p_ruta text)
returns void language plpgsql security definer set search_path = public
as $$
declare c public.cobros_club;
begin
  select * into c from cobros_club where id = p_cobro for update;
  if not found then raise exception 'No encontramos ese cobro'; end if;
  if c.cliente_id <> auth.uid() then raise exception 'Ese cobro no es tuyo'; end if;
  if c.estado = 'aprobado' then raise exception 'Ese cobro ya está aprobado'; end if;
  if coalesce(p_ruta, '') = '' then raise exception 'Falta el comprobante'; end if;

  update cobros_club set comprobante = p_ruta, estado = 'por_verificar', nota = null
   where id = c.id;
  update suscripciones set pago_estado = 'por_verificar' where id = c.suscripcion_id;
end;
$$;

create or replace function public.verificar_cobro_club(p_cobro bigint, p_aprobado boolean, p_nota text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare c public.cobros_club; s public.suscripciones;
begin
  if not public.es_equipo() then raise exception 'Solo el equipo verifica los pagos'; end if;

  select * into c from cobros_club where id = p_cobro for update;
  if not found then raise exception 'No encontramos ese cobro'; end if;
  if c.comprobante is null then raise exception 'Ese cobro todavía no tiene comprobante'; end if;

  update cobros_club
     set estado = case when p_aprobado then 'aprobado' else 'rechazado' end,
         nota = p_nota, verificado_por = auth.uid(), verificado_en = now()
   where id = c.id;

  select * into s from suscripciones where id = c.suscripcion_id for update;

  if p_aprobado then
    -- Pagado el envío, la suscripción avanza al siguiente. Eso es lo que hace que el cobro
    -- sea recurrente y no un pago suelto.
    update suscripciones
       set pago_estado = 'aprobado',
           proximo_envio = greatest(c.periodo, current_date) + s.frecuencia
     where id = s.id;
  else
    update suscripciones set pago_estado = 'rechazado' where id = s.id;
  end if;
end;
$$;

-- ---------- 6. Lo recurrente ----------
-- Genera el cobro de los envíos que se vienen, tres días antes. Se salta las suscripciones
-- pausadas y las que ya tienen cobro de ese envío.
create or replace function public.generar_cobros_club()
returns integer language plpgsql security definer set search_path = public
as $$
declare n integer := 0;
begin
  insert into cobros_club (suscripcion_id, cliente_id, periodo, monto)
  select s.id, s.cliente_id, s.proximo_envio,
         public.precio_club(s.cafe, s.gramos, s.frecuencia)
    from suscripciones s
   where s.estado = 'activa'
     and s.proximo_envio <= current_date + 3
     and (s.pausa_hasta is null or s.pausa_hasta <= current_date)
  on conflict (suscripcion_id, periodo) do nothing;

  get diagnostics n = row_count;

  update suscripciones s set pago_estado = 'pendiente'
    from cobros_club c
   where c.suscripcion_id = s.id and c.estado = 'pendiente' and s.pago_estado = 'aprobado';

  return n;
end;
$$;

-- pg_cron puede no estar habilitado en el proyecto. Si no está, la migración no debe caerse:
-- los cobros se pueden generar a mano desde el panel o con un select.
do $$
begin
  perform cron.unschedule('cobros-del-club');
exception when others then null;
end $$;

do $$
begin
  perform cron.schedule('cobros-del-club', '0 6 * * *', $cmd$select public.generar_cobros_club()$cmd$);
exception when others then
  raise notice 'pg_cron no disponible: generá los cobros con  select public.generar_cobros_club();';
end $$;

-- ---------- 7. Permisos ----------
revoke all on function public.guardar_suscripcion(integer, integer, text, text, date, integer, date, text, date) from public, anon;
revoke all on function public.cancelar_suscripcion() from public, anon;
revoke all on function public.enviar_comprobante_club(bigint, text) from public, anon;
revoke all on function public.verificar_cobro_club(bigint, boolean, text) from public, anon;
revoke all on function public.generar_cobros_club() from public, anon;

grant execute on function public.guardar_suscripcion(integer, integer, text, text, date, integer, date, text, date) to authenticated;
grant execute on function public.cancelar_suscripcion() to authenticated;
grant execute on function public.enviar_comprobante_club(bigint, text) to authenticated;
grant execute on function public.verificar_cobro_club(bigint, boolean, text) to authenticated;
grant execute on function public.generar_cobros_club() to authenticated;

-- El precio es información pública: la pantalla del Club lo muestra antes de iniciar sesión.
grant execute on function public.precio_club(text, integer, integer) to anon, authenticated;
