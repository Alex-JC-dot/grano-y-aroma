-- =====================================================================
-- Grano y Aroma · 006 · Tienda desde la base de datos
--   · La web lee el catálogo de aquí: precio, stock y productos nuevos que
--     publique el admin aparecen solos (RF-01, RF-05, RF-21).
--   · Se guardan también los datos de presentación que antes vivían en el
--     código: moliendas, foto (con la zona de la etiqueta) y color de la bolsa.
--   · Realtime en productos: si alguien compra lo último, se ve "Agotado".
-- =====================================================================

-- Bebidas y pastelería de la barra: se venden en la caja, no en la tienda en línea (ver 007).
alter type public.categoria add value if not exists 'bebida';

alter table public.productos
  add column if not exists grupo     text,           -- agrupación en la caja (Bebidas calientes…)
  add column if not exists moliendas text[] not null default array['Única'],
  add column if not exists foto      jsonb,          -- {"src": "...", "etiqueta": {...}}
  add column if not exists color     text,           -- color de la franja de la bolsa
  add column if not exists orden     integer not null default 1000;

-- Ids para los productos nuevos del admin: p100, p101…
create sequence if not exists public.productos_num start 100;
alter table public.productos alter column id set default ('p' || nextval('public.productos_num'));

-- Datos de presentación (generados desde src/lib/data.ts)
update public.productos set moliendas = array['Grano Entero','V60','Chemex'], foto = null, color = '#b5603f' where id = 'p1';
update public.productos set moliendas = array['Grano Entero','Espresso','V60','Moka'], foto = null, color = '#5f6b3a' where id = 'p2';
update public.productos set moliendas = array['Grano Entero','Espresso','French Press'], foto = null, color = '#c4952f' where id = 'p3';
update public.productos set moliendas = array['Grano Entero','Espresso','Moka','French Press'], foto = null, color = '#3a3532' where id = 'p4';
update public.productos set moliendas = array['Grano Entero','V60','Chemex','Aeropress'], foto = null, color = '#7a2e35' where id = 'p5';
update public.productos set moliendas = array['Grano Entero','Espresso','V60'], foto = null, color = '#5d7b95' where id = 'p6';
update public.productos set moliendas = array['Molienda media (filtro)','Molienda fina (espresso)'], foto = '{"src":"/images/tienda/frasco.webp","etiqueta":{"x":31,"y":47,"w":45,"h":28,"tono":"oscuro","texto":"Café molido"}}'::jsonb, color = null where id = 'p7';
update public.productos set moliendas = array['Única'], foto = '{"src":"/images/tienda/jarabe.webp","etiqueta":{"x":36,"y":43,"w":28,"h":38,"tono":"claro","texto":"Jarabe de caramelo"}}'::jsonb, color = null where id = 'p8';
update public.productos set moliendas = array['Única'], foto = '{"src":"/images/tienda/vaso.webp","etiqueta":{"x":32,"y":44,"w":40,"h":21,"tono":"oscuro","texto":"Para llevar"}}'::jsonb, color = null where id = 'p9';
update public.productos set moliendas = array['Única'], foto = '{"src":"/images/tienda/mandil.webp","etiqueta":{"x":38,"y":37,"w":19,"h":10,"tono":"oscuro","texto":""}}'::jsonb, color = null where id = 'p10';
update public.productos set moliendas = array['Única'], foto = '{"src":"/images/tienda/vasos-papel.webp"}'::jsonb, color = null where id = 'p11';
update public.productos set moliendas = array['Única'], foto = '{"src":"/images/tienda/taza.webp"}'::jsonb, color = null where id = 'p12';
update public.productos set moliendas = array['Única'], foto = '{"src":"/images/tienda/vasos-marca.webp"}'::jsonb, color = null where id = 'p13';
update public.productos set moliendas = array['Única'], foto = '{"src":"/images/tienda/kit-llevar.webp"}'::jsonb, color = null where id = 'p14';
update public.productos set moliendas = array['Única'], foto = '{"src":"/images/tienda/cafetera-goteo.webp"}'::jsonb, color = null where id = 'p15';
update public.productos set moliendas = array['Única'], foto = '{"src":"/images/tienda/cafetera-espresso.webp"}'::jsonb, color = null where id = 'p16';
update public.productos set moliendas = array['Única'], foto = '{"src":"/images/tienda/moka.webp"}'::jsonb, color = null where id = 'p17';

update public.productos set orden = substring(id from 2)::int where id ~ '^p[0-9]+$' and orden = 1000;

alter publication supabase_realtime add table public.productos;
