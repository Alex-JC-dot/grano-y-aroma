-- =====================================================================
-- Grano y Aroma · 018 · Más cafés fríos y bebidas
-- =====================================================================
-- Seis cafés fríos y seis bebidas para la barra. Salen en la Caja y en el tótem (el admin los
-- enciende o apaga en Productos). Los precios son una propuesta: se cambian ahí mismo.
-- Ejecutar DESPUÉS de la 017. Se puede ejecutar más de una vez: no duplica ni pisa cambios.

insert into public.productos (id, nombre, categoria, descripcion, precio, stock, stock_minimo, grupo, orden, en_totem)
select v.id, v.nombre, 'bebida', v.descripcion, v.precio, v.stock, v.minimo, v.grupo, v.orden, true
from (values
  ('b-americano-helado', 'Americano helado',       'Espresso largo con hielo',                20, 999, 0, 'Bebidas frías', 40),
  ('b-mocaccino-helado', 'Mocaccino helado',       'Espresso, chocolate y leche con hielo',   30, 999, 0, 'Bebidas frías', 41),
  ('b-macchiato-caram',  'Macchiato de caramelo',  'Leche fría, espresso y caramelo',         30, 999, 0, 'Bebidas frías', 42),
  ('b-matcha-helado',    'Matcha helado',          'Té matcha con leche fría y hielo',        32, 999, 0, 'Bebidas frías', 43),
  ('b-frappe-choco',     'Frappé de chocolate',    'Café helado con chocolate y crema',       30,  40, 5, 'Bebidas frías', 44),
  ('b-espresso-tonica',  'Espresso tónica',        'Espresso sobre agua tónica y hielo',      28,  40, 5, 'Bebidas frías', 45),
  ('b-limonada',         'Limonada',               'De limón recién exprimido',               14,  40, 5, 'Otros',         50),
  ('b-jugo-naranja',     'Jugo de naranja',        'Natural, exprimido al momento',           16,  40, 5, 'Otros',         51),
  ('b-te-helado',        'Té helado de durazno',   'Té negro frío con durazno',               16,  40, 5, 'Otros',         52),
  ('b-mocochinchi',      'Mocochinchi',            'Refresco boliviano de durazno seco',      10,  40, 5, 'Otros',         53),
  ('b-mate-coca',        'Mate de coca',           'Infusión caliente de hoja de coca',       10, 999, 0, 'Otros',         54),
  ('b-agua-gas',         'Agua con gas',           'Botella de 500 ml',                        9,  50, 5, 'Otros',         55)
) as v(id, nombre, descripcion, precio, stock, minimo, grupo, orden)
where not exists (select 1 from public.productos p where lower(p.nombre) = lower(v.nombre))
on conflict (id) do nothing;
