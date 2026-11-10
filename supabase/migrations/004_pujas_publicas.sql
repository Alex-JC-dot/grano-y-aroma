-- 004 · Reemplaza la vista pujas_publicas (SECURITY DEFINER, marcada como crítica por el
-- asesor de Supabase) por una función explícita. Devuelve las pujas de UN lote con el nombre
-- corto del postor y si la puja es tuya, sin exponer el id de nadie.

drop view if exists public.pujas_publicas;

create or replace function public.pujas_de(p_subasta bigint)
returns table (id bigint, monto numeric, creado_en timestamptz, postor text, es_mia boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.monto, p.creado_en,
         split_part(pf.nombre, ' ', 1) || coalesce(' ' || nullif(left(split_part(pf.nombre, ' ', 2), 1), '') || '.', ''),
         p.postor_id = auth.uid()
  from pujas p
  join perfiles pf on pf.id = p.postor_id
  where p.subasta_id = p_subasta
  order by p.monto desc, p.creado_en asc;
$$;

revoke all on function public.pujas_de(bigint) from public;
grant execute on function public.pujas_de(bigint) to anon, authenticated;
