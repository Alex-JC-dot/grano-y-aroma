-- =====================================================================
-- Grano y Aroma · 003 · Cierre automático de subastas y datos iniciales
-- =====================================================================

-- Cierre automático cada minuto (RF-14). En Supabase: Database → Extensions → pg_cron
-- debe estar activado (este comando lo activa si el proyecto lo permite).
create extension if not exists pg_cron;
select cron.schedule('cerrar-subastas', '* * * * *', $$select public.cerrar_subastas_vencidas()$$);

-- Datos iniciales (generados desde src/lib/data.ts para que coincidan con la web).
insert into public.productos (id, nombre, categoria, descripcion, presentacion, precio, stock, origen, region, altitud, tueste, perfil, codigo_lote, puntaje, fecha_tueste) values
  ('p1', 'Villa Serrano Natural', 'grano', 'Notas de maracuyá, jazmín y limón meyer. Final largo y elegante.', 'Bolsa de 250 g', 145, 42, 'Chuquisaca', 'Villa Serrano', 1850, 'Ligero', array['Frutal','Floral','Cítrico'], 'VS-2025-NAT-001', 87.5, '2025-10-05'),
  ('p2', 'Padilla Washed Especial', 'grano', 'Chocolate amargo, caramelo tostado y almendra. Cuerpo redondo.', 'Bolsa de 250 g', 125, 60, 'Chuquisaca', 'Padilla', 1750, 'Medio', array['Chocolate','Caramelo','Nuez'], 'PAD-2025-WAS-003', 86, '2025-10-03'),
  ('p3', 'Caranavi Honey Process', 'grano', 'Miel, durazno maduro y cacao. Muy dulce y equilibrado.', 'Bolsa de 250 g', 110, 80, 'La Paz', 'Caranavi, Yungas', 1600, 'Medio', array['Chocolate','Frutal','Miel'], 'CAR-2025-HON-007', 85.5, '2025-10-01'),
  ('p4', 'Coroico Dark Roast', 'grano', 'Chocolate oscuro, tabaco y especias. Ideal para espresso.', 'Bolsa de 250 g', 95, 100, 'La Paz', 'Coroico, Yungas', 1400, 'Oscuro', array['Chocolate','Intenso','Ahumado'], 'COR-2025-DAR-002', 85, '2025-09-28'),
  ('p5', 'Villa Serrano Gesha', 'grano', 'Bergamota, durazno blanco, té de jazmín. Excepcional.', 'Bolsa de 250 g', 280, 15, 'Chuquisaca', 'Villa Serrano', 1920, 'Ligero', array['Floral','Frutal','Cítrico'], 'VS-2025-GES-001', 90, '2025-10-07'),
  ('p6', 'Padilla Bourbon Natural', 'grano', 'Cereza madura, caramelo y avellana. Fermentación natural controlada.', 'Bolsa de 250 g', 165, 30, 'Chuquisaca', 'Padilla', 1680, 'Medio', array['Frutal','Caramelo','Nuez'], 'PAD-2025-BOU-005', 87, '2025-10-06'),
  ('p7', 'Padilla Washed molido', 'molido', 'El mismo lote Padilla Washed, molido el día del envío y sellado en frasco de vidrio.', 'Frasco de vidrio de 250 g', 85, 40, 'Chuquisaca', 'Padilla', 1750, 'Medio', array['Chocolate','Caramelo','Nuez'], 'PAD-2025-WAS-003', 86, '2025-10-03'),
  ('p8', 'Jarabe de caramelo', 'jarabe', 'Caramelo de azúcar tostada para lattes y capuchinos. Una pulsación por taza.', 'Botella con dosificador, 500 ml', 65, 24, null, null, null, null, null, null, null, null),
  ('p9', 'Vaso reutilizable para llevar', 'accesorio', 'Reutilizable y lavable, para llevar tu café de todos los días sin vasos desechables.', '350 ml, tapa y faja de silicona', 55, 30, null, null, null, null, null, null, null, null),
  ('p10', 'Mandil de barista', 'accesorio', 'Lona de algodón resistente, bolsillos al frente y tiras de cuero ajustables.', 'Lona de algodón, tiras de cuero', 160, 12, null, null, null, null, null, null, null, null),
  ('p11', 'Vasos compostables con portavasos', 'accesorio', 'Vasos de papel compostables con tapa y portavasos de cartón, para oficinas y eventos.', 'Paquete de 25 vasos de 8 oz y 10 portavasos', 45, 50, null, null, null, null, null, null, null, null),
  ('p12', 'Taza de cerámica Grano y Aroma', 'accesorio', 'La taza de nuestra barra, con el sello de la casa.', 'Taza de 350 ml, apta para lavavajillas', 60, 20, null, null, null, null, null, null, null, null),
  ('p13', 'Vasos de papel Grano y Aroma', 'accesorio', 'Vasos de doble pared para servir café para llevar en tu oficina o evento.', 'Paquete de 50 vasos de 12 oz', 70, 20, null, null, null, null, null, null, null, null),
  ('p14', 'Kit para llevar: vaso y bolsa', 'accesorio', 'Un vaso para llevar y una bolsa de café de la casa, listos para regalar.', 'Vaso con tapa y bolsa kraft de 250 g', 120, 20, null, null, null, null, null, null, null, null),
  ('p15', 'Cafetera de goteo', 'equipo', 'Prepara hasta 10 tazas de café filtrado. Ideal para el café en grano molido medio.', 'Programable, jarra de vidrio de 1,2 L', 680, 20, null, null, null, null, null, null, null, null),
  ('p16', 'Máquina de espresso con molino', 'equipo', 'Muele el grano justo antes de cada espresso. Dos tazas a la vez.', 'Molino integrado, vaporizador de leche', 4900, 20, null, null, null, null, null, null, null, null),
  ('p17', 'Cafetera moka', 'equipo', 'La cafetera italiana de estufa, para un café intenso con molienda fina.', 'Aluminio, 6 tazas', 190, 20, null, null, null, null, null, null, null, null)
on conflict (id) do nothing;

insert into public.subastas (titulo, descripcion, origen, altitud, cantidad_kg, puntaje, codigo_lote, imagen, precio_base, cierra_en, creado_por) values
  ('Gesha Villa Serrano — Micro-lote Exclusivo', 'Varietal Gesha procesado natural en una finca familiar a 1920 msnm. Solo 10 kg disponibles. Perfil taza: bergamota, jazmín, durazno blanco.', 'Villa Serrano, Chuquisaca', 1920, 10, 90, 'VS-2025-GES-001-AUC', '/images/subastas/gesha.webp', 450, now() + interval '48 hours', null),
  ('Bourbon Natural Padilla — Lote Fundador', 'Bourbon natural de la familia Veizaga. Doble fermentación aeróbica. Producción limitada de la temporada 2025.', 'Padilla, Chuquisaca', 1680, 25, 87, 'PAD-2025-BOU-005-AUC', '/images/subastas/bourbon.webp', 280, now() + interval '96 hours', null),
  ('Villa Serrano Natural — Reserva Seleccionada', 'Primera subasta del lote Natural 001. Sin pujas aún. ¡Sé el primero en ofertar este micro-lote exclusivo de Chuquisaca!', 'Villa Serrano, Chuquisaca', 1850, 20, 87.5, 'VS-2025-NAT-001-AUC', '/images/subastas/reserva.webp', 320, now() + interval '24 hours', null);
