-- =====================================================================
-- Grano y Aroma · 020 · El código del pedido nunca se repite
-- =====================================================================
-- El código (GA-261126-4942) llevaba 4 dígitos al azar y, si salía uno ya usado ese día, la
-- compra fallaba con "duplicate key". Con pocos pedidos casi no pasa; con unos 100 en un día
-- (la feria) hay cerca de un 39 % de que falle alguna.
--
-- Ahora la base prueba otro número hasta encontrar uno libre. Además usa la fecha de Bolivia:
-- antes, después de las 20:00 salía la fecha del día siguiente (hora UTC).
--
-- No cambia los pedidos que ya existen. Se puede ejecutar más de una vez.

create or replace function public.nuevo_codigo_pedido()
returns text language plpgsql volatile security definer set search_path = public
as $$
declare
  base text := 'GA-' || to_char(now() at time zone 'America/La_Paz', 'YYMMDD') || '-';
  c text;
begin
  for i in 1..40 loop
    -- Los primeros intentos, con 4 dígitos; si el día está muy lleno, con 6.
    c := base || case when i <= 25 then lpad(floor(random() * 10000)::int::text, 4, '0')
                      else lpad(floor(random() * 1000000)::int::text, 6, '0') end;
    exit when not exists (select 1 from pedidos where codigo = c);
  end loop;
  return c;
end;
$$;

alter table public.pedidos alter column codigo set default public.nuevo_codigo_pedido();

grant execute on function public.nuevo_codigo_pedido() to authenticated;
