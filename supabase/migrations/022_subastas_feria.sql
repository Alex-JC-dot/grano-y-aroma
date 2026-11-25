-- =====================================================================
-- Grano y Aroma · 022 · Subastas para la feria (5 en vivo y 2 próximas)
-- =====================================================================
-- · Agrega cinco lotes en vivo que cierran entre el 1 y el 5 de diciembre de 2026, y dos
--   próximos que abren solos (pg_cron) el 28 y el 30 de noviembre y cierran el 6 y el 7.
-- · Corrige tres lotes cargados con errores de escritura ("Gesah", "Veilla", variedad
--   "variedad", puntaje de 10 y de 70). No toca sus pujas ni sus fechas.
--
-- Los datos de los lotes son de demostración. Se puede ejecutar más de una vez: los lotes se
-- buscan por su código y no se duplican.

-- ---------- 1. Correcciones ----------
update public.subastas
   set titulo = 'Gesha Villa Serrano', origen = 'Villa Serrano, Chuquisaca', variedad = 'Gesha', puntaje = 88.0,
       descripcion = 'Floral y delicado, con notas de jazmín, durazno y té blanco.', cosecha = 'Junio de 2026',
       historia = 'Cosechado a mano en junio de 2026 y secado al sol en camas elevadas durante veinte días.',
       catacion = '[["Aroma",9.0],["Sabor",8.75],["Acidez",8.5],["Cuerpo",8.0],["Dulzor",8.75],["Final",8.5]]'::jsonb
 where codigo_lote = 'VS-2025-GES-003-AUC';

update public.subastas
   set origen = 'Padilla, Chuquisaca', variedad = 'Bourbon rojo', puntaje = 86.0,
       descripcion = 'Dulce y redondo, con notas de panela, cereza madura y cacao.',
       historia = 'Bourbon rojo de secado natural, de los cafetales altos de Padilla.',
       catacion = '[["Aroma",8.25],["Sabor",8.5],["Acidez",8.0],["Cuerpo",8.5],["Dulzor",8.75],["Final",8.25]]'::jsonb
 where codigo_lote = 'VS-2026-BOU-009-AUC';

update public.subastas
   set titulo = 'Gesha Villa Serrano — Segunda cosecha', origen = 'Villa Serrano, Chuquisaca', variedad = 'Gesha', puntaje = 87.0,
       catacion = '[["Aroma",8.5],["Sabor",8.5],["Acidez",8.5],["Cuerpo",8.25],["Dulzor",8.75],["Final",8.5]]'::jsonb
 where codigo_lote = 'VS-2005';

-- ---------- 2. Lotes nuevos ----------
insert into public.subastas (titulo, descripcion, origen, altitud, cantidad_kg, puntaje, codigo_lote, imagen, imagen_alt,
                             variedad, proceso, cosecha, finca, historia, catacion, precio_base, incremento, abre_en, cierra_en, estado)
select v.titulo, v.descripcion, v.origen, v.altitud, v.kg, v.puntaje, v.codigo, v.imagen, v.alt, v.variedad, v.proceso, v.cosecha,
       v.finca, v.historia, v.catacion::jsonb, v.base, v.inc, coalesce(v.abre::timestamptz, now()), v.cierra::timestamptz,
       (case when v.abre is null then 'activa' else 'proxima' end)::public.estado_subasta
from (values
  -- En vivo
  ('Caranavi Catuaí — Honey rojo', 'Secado como honey rojo en camas africanas: panela, ciruela y cacao.',
   'Caranavi, Yungas de La Paz', 1600, 18.0, 87.0, 'CAR-2026-CAT-011-AUC', '/images/origen/caranavi.webp',
   'Cerros cubiertos de bosque en Caranavi con un río de niebla en el valle',
   'Catuaí', 'Honey rojo', 'Agosto de 2026', 'Cooperativa de Caranavi',
   'Las cerezas se despulpan dejando casi todo el mucílago y se secan tres semanas bajo techo ventilado.',
   '[["Aroma",8.5],["Sabor",8.75],["Acidez",8.25],["Cuerpo",8.75],["Dulzor",9.0],["Final",8.5]]',
   340.00, 50.00, null, '2026-12-01 20:00-04'),

  ('Coroico Typica — Lavado de altura', 'Fermentado 36 horas y lavado con agua de vertiente: mandarina y miel.',
   'Coroico, Yungas de La Paz', 1450, 14.0, 86.5, 'COR-2026-TYP-012-AUC', '/images/origen/coroico.webp',
   'Montañas verdes de Coroico con niebla en el fondo del valle',
   'Typica', 'Lavado', 'Julio de 2026', 'Productores de Coroico',
   'Viene de cafetos de más de treinta años que conservan la Typica original de los Yungas.',
   '[["Aroma",8.5],["Sabor",8.5],["Acidez",8.75],["Cuerpo",8.0],["Dulzor",8.5],["Final",8.25]]',
   300.00, 20.00, null, '2026-12-02 19:00-04'),

  ('Villa Serrano Java — Natural anaeróbico', 'Fermentación anaeróbica de 72 horas: frutos rojos, vino tinto y chocolate.',
   'Villa Serrano, Chuquisaca', 1880, 9.0, 88.5, 'VS-2026-JAV-013-AUC', '/images/subastas/bourbon.webp',
   'Cerezas de café secándose al sol en camas elevadas',
   'Java', 'Natural anaeróbico', 'Junio de 2026', 'Finca familiar en Villa Serrano',
   'Un experimento de la finca: tres días en tanques cerrados y después secado entero. Solo salieron 9 kg.',
   '[["Aroma",9.0],["Sabor",8.75],["Acidez",8.5],["Cuerpo",8.5],["Dulzor",8.75],["Final",8.75]]',
   420.00, 50.00, null, '2026-12-03 20:00-04'),

  ('Padilla Caturra — Honey amarillo', 'Secado lento en pergamino: dulzor de miel, durazno y nuez.',
   'Padilla, Chuquisaca', 1720, 15.0, 86.0, 'PAD-2026-CAT-014-AUC', '/images/subastas/pergamino.webp',
   'Café en pergamino extendido en una cama de secado con un rastrillo de madera',
   'Caturra', 'Honey amarillo', 'Julio de 2026', 'Familia Veizaga, Padilla',
   'Se remueve cada dos horas con rastrillo de madera para que el secado sea parejo.',
   '[["Aroma",8.25],["Sabor",8.5],["Acidez",8.25],["Cuerpo",8.25],["Dulzor",8.75],["Final",8.25]]',
   280.00, 20.00, null, '2026-12-04 18:00-04'),

  ('Reserva del Tostador — Gesha y Bourbon', 'El lote más cuidado del año: jazmín, frutilla y caramelo.',
   'Chuquisaca', 1950, 6.0, 90.0, 'RES-2026-TOS-015-AUC', '/images/home/microlote.webp',
   'Saco de yute con granos de café verde derramados',
   'Gesha y Bourbon', 'Natural', 'Junio de 2026', 'Selección Grano y Aroma',
   'Granos elegidos uno por uno por nuestro tostador. Solo hay 6 kg y no se repetirá.',
   '[["Aroma",9.25],["Sabor",9.0],["Acidez",8.75],["Cuerpo",8.75],["Dulzor",9.0],["Final",9.0]]',
   650.00, 100.00, null, '2026-12-05 20:00-04'),

  -- Próximas
  ('Coroico Pacamara — Natural', 'Grano gigante y taza intensa: mango, ron y cacao.',
   'Coroico, Yungas de La Paz', 1550, 10.0, 88.0, 'COR-2026-PAC-016-AUC', '/images/home/verde-kling.webp',
   'Saco de tela lleno de granos de café verde',
   'Pacamara', 'Natural', 'Agosto de 2026', 'Productores de Coroico',
   'Una variedad poco común en Bolivia: sus granos son casi el doble de grandes.',
   '[["Aroma",8.75],["Sabor",8.75],["Acidez",8.25],["Cuerpo",9.0],["Dulzor",8.75],["Final",8.5]]',
   380.00, 50.00, '2026-11-28 10:00-04', '2026-12-06 20:00-04'),

  ('Chuquisaca Castillo — Doble fermentación', 'Dos fermentaciones seguidas: piña, canela y miel de caña.',
   'Villa Serrano, Chuquisaca', 1800, 20.0, 86.5, 'CHU-2026-CAS-017-AUC', '/images/origen/chuquisaca.webp',
   'Colinas de tierra rojiza en Chuquisaca con una rama de cafeto en primer plano',
   'Castillo', 'Doble fermentación', 'Julio de 2026', 'Asociación de Villa Serrano',
   'El primer lote de la asociación con este proceso, hecho junto a nuestro equipo de tueste.',
   '[["Aroma",8.5],["Sabor",8.5],["Acidez",8.5],["Cuerpo",8.25],["Dulzor",8.75],["Final",8.25]]',
   260.00, 20.00, '2026-11-30 10:00-04', '2026-12-07 20:00-04')
) as v (titulo, descripcion, origen, altitud, kg, puntaje, codigo, imagen, alt, variedad, proceso, cosecha, finca, historia, catacion, base, inc, abre, cierra)
where not exists (select 1 from public.subastas s where s.codigo_lote = v.codigo);

select estado, count(*) from public.subastas group by estado order by estado;
