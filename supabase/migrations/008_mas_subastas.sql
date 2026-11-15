-- =====================================================================
-- Grano y Aroma · 008 · Tres subastas más, en vivo
-- =====================================================================
-- Lotes de orígenes que todavía no tenían subasta: Caranavi y Coroico (Yungas de La Paz) y
-- Villa Serrano (Chuquisaca). Abren al ejecutar este script y cierran solas con el cron de 003.
-- Se puede ejecutar más de una vez: no duplica los lotes (se busca por codigo_lote).

insert into public.subastas (titulo, descripcion, origen, altitud, cantidad_kg, puntaje, codigo_lote, imagen, imagen_alt,
                             variedad, proceso, cosecha, finca, historia, catacion, precio_base, abre_en, cierra_en, estado)
select * from (values
  ('Caranavi Catuaí — Honey rojo',
   'Micro-lote de Catuaí secado como honey rojo en camas africanas. Taza dulce, con panela, ciruela y cacao.',
   'Caranavi, Yungas de La Paz', 1600, 18.0, 87.0, 'CAR-2025-CAT-009-AUC',
   '/images/origen/caranavi.webp',
   'Cerros cubiertos de bosque en Caranavi con un río de niebla en el valle al amanecer',
   'Catuaí', 'Honey rojo', 'Agosto de 2025', 'Cooperativa de Caranavi',
   'Las cerezas se despulpan dejando casi todo el mucílago y se secan durante tres semanas bajo techo ventilado. Es el lote más dulce de la cooperativa esta temporada.',
   '[["Aroma",8.5],["Sabor",8.75],["Acidez",8.25],["Cuerpo",8.75],["Dulzor",9.0],["Final",8.5]]'::jsonb,
   340.00, now(), now() + interval '2 days 6 hours', 'activa'::public.estado_subasta),

  ('Coroico Typica — Lavado de altura',
   'Typica de plantas antiguas, fermentado 36 horas y lavado con agua de vertiente. Limpio, con mandarina y miel.',
   'Coroico, Yungas de La Paz', 1450, 14.0, 86.5, 'COR-2025-TYP-010-AUC',
   '/images/origen/coroico.webp',
   'Montañas empinadas y verdes de Coroico con niebla en el fondo del valle',
   'Typica', 'Lavado', 'Julio de 2025', 'Productores de Coroico',
   'Viene de cafetos de más de treinta años que todavía conservan la Typica original de los Yungas. Se cosechó en dos pasadas para elegir solo cerezas maduras.',
   '[["Aroma",8.5],["Sabor",8.5],["Acidez",8.75],["Cuerpo",8.0],["Dulzor",8.5],["Final",8.25]]'::jsonb,
   300.00, now(), now() + interval '3 days 12 hours', 'activa'::public.estado_subasta),

  ('Villa Serrano Java — Natural anaeróbico',
   'Varietal Java con fermentación anaeróbica de 72 horas antes del secado natural. Frutos rojos, vino tinto y chocolate.',
   'Villa Serrano, Chuquisaca', 1880, 9.0, 88.5, 'VS-2025-JAV-011-AUC',
   '/images/origen/chuquisaca.webp',
   'Colinas de tierra rojiza en Chuquisaca bajo un cielo azul, con una rama de cafeto con cerezas en primer plano',
   'Java', 'Natural anaeróbico', 'Junio de 2025', 'Finca familiar en Villa Serrano',
   'Un experimento de la finca: las cerezas fermentan tres días en tanques cerrados y después se secan enteras. Solo salieron 9 kg, todos en esta subasta.',
   '[["Aroma",9.0],["Sabor",8.75],["Acidez",8.5],["Cuerpo",8.5],["Dulzor",8.75],["Final",8.75]]'::jsonb,
   420.00, now(), now() + interval '5 days', 'activa'::public.estado_subasta)
) as v
where not exists (
  select 1 from public.subastas
  where codigo_lote in ('CAR-2025-CAT-009-AUC', 'COR-2025-TYP-010-AUC', 'VS-2025-JAV-011-AUC')
);
