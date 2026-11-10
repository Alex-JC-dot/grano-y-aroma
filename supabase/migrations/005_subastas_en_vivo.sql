-- =====================================================================
-- Grano y Aroma · 005 · Subastas en vivo
--   · La ficha del lote (variedad, proceso, catación…) vive en la base, así el admin
--     puede publicar lotes nuevos desde el panel (RF-10).
--   · lider_nombre y num_pujas viajan en la fila de la subasta: con Realtime, todos
--     ven al instante quién va primero y cuántas pujas hay (RF-11, RF-13, RNF-02).
--   · Próximas y cerradas (historial, RF-16) también salen de la base.
-- =====================================================================

alter table public.subastas
  add column if not exists imagen_alt     text,
  add column if not exists variedad       text,
  add column if not exists proceso        text,
  add column if not exists cosecha        text,
  add column if not exists finca          text,
  add column if not exists historia       text,
  add column if not exists catacion       jsonb,          -- [["Aroma", 9.0], …]
  add column if not exists lider_nombre   text,
  add column if not exists ganador_nombre text,
  add column if not exists num_pujas      integer not null default 0;

-- Nombre corto y público de una cuenta: "Alex C."
create or replace function public.nombre_corto(p_id uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select split_part(nombre, ' ', 1) || coalesce(' ' || nullif(left(split_part(nombre, ' ', 2), 1), '') || '.', '')
  from perfiles where id = p_id;
$$;
revoke all on function public.nombre_corto(uuid) from public;

-- Puja segura (reemplaza la de 002): además guarda el nombre corto del líder y cuenta las pujas.
create or replace function public.realizar_puja(p_subasta bigint, p_monto numeric)
returns public.subastas
language plpgsql security definer set search_path = public
as $$
declare s public.subastas; minimo numeric;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión para pujar'; end if;
  select * into s from subastas where id = p_subasta for update;          -- RNF-09: una puja a la vez
  if not found then raise exception 'La subasta no existe'; end if;
  if s.estado <> 'activa' or now() < s.abre_en or now() >= s.cierra_en then
    raise exception 'La subasta no está abierta';
  end if;
  if s.lider_id = auth.uid() then raise exception 'Ya vas primero en este lote'; end if;
  minimo := coalesce(s.puja_actual + s.incremento, s.precio_base);
  if p_monto < minimo then raise exception 'La puja mínima es Bs. %', minimo; end if;

  insert into pujas (subasta_id, postor_id, monto) values (p_subasta, auth.uid(), p_monto);
  update subastas
     set puja_actual = p_monto, lider_id = auth.uid(), lider_nombre = public.nombre_corto(auth.uid()), num_pujas = num_pujas + 1
   where id = p_subasta
  returning * into s;
  return s;
end;
$$;

-- Cierre automático (reemplaza la de 002): guarda también el nombre del ganador.
create or replace function public.cerrar_subastas_vencidas()
returns integer
language plpgsql security definer set search_path = public
as $$
declare s public.subastas; n integer := 0; ped bigint;
begin
  update subastas set estado = 'activa' where estado = 'proxima' and now() >= abre_en;
  for s in select * from subastas where estado = 'activa' and now() >= cierra_en for update skip locked loop
    ped := null;
    if s.lider_id is not null then
      insert into pedidos (cliente_id, canal, total, metodo_pago, nombre)
      values (s.lider_id, 'subasta', s.puja_actual, 'pendiente', 'Subasta: ' || s.titulo)
      returning id into ped;
    end if;
    update subastas set estado = 'cerrada', ganador_id = s.lider_id, ganador_nombre = s.lider_nombre, pedido_id = ped
     where id = s.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Avisos de apertura: el cliente puede ver y borrar los suyos (la política de 002 ya lo permite).

-- ---------- Fichas de los lotes publicados en 003 ----------
update public.subastas set
  imagen_alt = 'Rama de cafeto con cerezas rojas maduras sobre un valle al amanecer',
  variedad = 'Gesha', proceso = 'Natural', cosecha = 'Junio de 2025', finca = 'Finca familiar en Villa Serrano',
  historia = 'Un pequeño grupo de plantas de Gesha cultivadas a 1.920 msnm. Las cerezas se secan enteras sobre camas elevadas durante cuatro semanas, lo que da su perfil floral y a frutas blancas.',
  catacion = '[["Aroma",9.0],["Sabor",9.0],["Acidez",8.75],["Cuerpo",8.25],["Dulzor",9.0],["Final",8.75]]'
where codigo_lote = 'VS-2025-GES-001-AUC';

update public.subastas set
  imagen_alt = 'Cerezas de café secándose al sol en camas elevadas',
  variedad = 'Bourbon', proceso = 'Natural, doble fermentación aeróbica', cosecha = 'Mayo de 2025', finca = 'Familia Veizaga, Padilla',
  historia = 'La familia Veizaga fermenta las cerezas dos veces antes de secarlas al sol. Es su primer lote en subasta, de producción limitada de la temporada 2025.',
  catacion = '[["Aroma",8.5],["Sabor",8.5],["Acidez",8.0],["Cuerpo",8.75],["Dulzor",8.75],["Final",8.25]]'
where codigo_lote = 'PAD-2025-BOU-005-AUC';

update public.subastas set
  imagen_alt = 'Muestra de café verde en una bandeja de madera junto a una lupa',
  descripcion = 'Selección de los mejores sacos del lote Natural 001 de Villa Serrano. Taza limpia, dulce y con acidez cítrica.',
  variedad = 'Caturra y Typica', proceso = 'Natural', cosecha = 'Junio de 2025', finca = 'Productores de Villa Serrano',
  historia = 'Selección de los mejores sacos del lote Natural 001, separada en la mesa de catación para esta subasta. Taza limpia, dulce y con acidez cítrica.',
  catacion = '[["Aroma",8.75],["Sabor",8.5],["Acidez",8.5],["Cuerpo",8.25],["Dulzor",8.75],["Final",8.5]]'
where codigo_lote = 'VS-2025-NAT-001-AUC';

-- ---------- Próximas (abren solas con el cron de 003) ----------
insert into public.subastas (titulo, descripcion, origen, altitud, cantidad_kg, puntaje, codigo_lote, imagen, imagen_alt,
                             variedad, proceso, cosecha, finca, precio_base, abre_en, cierra_en, estado)
select * from (values
  ('Typica Villa Serrano — Cosecha temprana', 'Cerezas recogidas a mano en la primera pasada de la cosecha, proceso lavado.',
   'Villa Serrano, Chuquisaca', 1900, 12.0, 86.5, 'VS-2025-TYP-007-AUC', '/images/subastas/cosecha.webp',
   'Canasta de mimbre con cerezas de café rojas y amarillas entre los cafetos',
   'Typica', 'Lavado', 'Julio de 2025', 'Productores de Villa Serrano', 380.00,
   now() + interval '2 days 5 hours', now() + interval '4 days 5 hours', 'proxima'::public.estado_subasta),
  ('Caturra Padilla — Honey amarillo', 'Secado lento en pergamino durante tres semanas. Dulzor de panela y durazno.',
   'Padilla, Chuquisaca', 1720, 15.0, 86.0, 'PAD-2025-CAT-008-AUC', '/images/subastas/pergamino.webp',
   'Café en pergamino extendido en una cama de secado con un rastrillo de madera',
   'Caturra', 'Honey amarillo', 'Julio de 2025', 'Familia Veizaga, Padilla', 300.00,
   now() + interval '5 days 2 hours', now() + interval '7 days 2 hours', 'proxima'::public.estado_subasta)
) as v
where not exists (select 1 from public.subastas where codigo_lote in ('VS-2025-TYP-007-AUC', 'PAD-2025-CAT-008-AUC'));

-- ---------- Historial: subastas de la temporada anterior (RF-16) ----------
insert into public.subastas (titulo, descripcion, origen, cantidad_kg, codigo_lote, imagen, imagen_alt,
                             precio_base, puja_actual, num_pujas, ganador_nombre, abre_en, cierra_en, estado)
select * from (values
  ('Gesha Villa Serrano — Lote 2024', 'Primer Gesha de la finca en subasta.', 'Villa Serrano, Chuquisaca', 8.0,
   'VS-2024-GES-001-AUC', '/images/subastas/catacion.webp', 'Taza de catación con una cuchara rompiendo la costra del café molido',
   450.00, 920.00, 14, 'Café Mirador SCZ', timestamptz '2025-09-15 10:00-04', timestamptz '2025-09-18 20:00-04', 'cerrada'::public.estado_subasta),
  ('Bourbon rojo Padilla — Natural', 'Bourbon rojo de secado natural.', 'Padilla, Chuquisaca', 20.0,
   'PAD-2024-BOU-002-AUC', '/images/subastas/entrega.webp', 'Saco pequeño de café verde con una etiqueta, listo para enviar junto a una caja',
   260.00, 540.00, 11, 'Roasters del Sur', timestamptz '2025-08-30 10:00-04', timestamptz '2025-09-02 20:00-04', 'cerrada'::public.estado_subasta)
) as v
where not exists (select 1 from public.subastas where codigo_lote in ('VS-2024-GES-001-AUC', 'PAD-2024-BOU-002-AUC'));
