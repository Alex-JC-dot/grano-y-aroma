-- =====================================================================
-- Grano y Aroma · 017 · El admin decide qué productos van al tótem
-- =====================================================================
-- Hasta la 016 el tótem mostraba toda la barra y todo el café en grano. Ahora cada producto
-- tiene un interruptor "En el tótem" en Admin → Productos, para cualquier categoría (también
-- jarabes, equipos o accesorios).
--
-- La primera vez se encienden los que ya se veían (barra y café en grano). Si se vuelve a
-- ejecutar, NO toca lo que el admin haya elegido. Ejecutar DESPUÉS de la 016.
--
-- Permisos: nada nuevo. Solo el admin puede escribir en productos (RLS de siempre).

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'productos' and column_name = 'en_totem'
  ) then
    alter table public.productos add column en_totem boolean not null default false;
    update public.productos set en_totem = true where categoria::text in ('bebida', 'grano');
  end if;
end $$;
