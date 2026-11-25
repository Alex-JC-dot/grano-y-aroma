-- =====================================================================
-- Grano y Aroma · 016 · Menú del tótem: productos nuevos y populares
-- =====================================================================
--   1. Ocho productos nuevos de barra (cafés y masitas). También aparecen en la Caja. Los
--      precios son una propuesta: se cambian en Admin → Productos.
--   2. populares_totem(): los más vendidos de los últimos 30 días, para la sección "Populares".
--      La cuenta del tótem no puede leer los pedidos, por eso lo calcula la base.
--
-- Las opciones del tótem (leche, azúcar) se guardan en pedido_items.molienda y "Para aquí" o
-- "Para llevar" en pedidos.referencia: no hacen falta columnas nuevas.
-- Ejecutar DESPUÉS de la 015. Se puede ejecutar más de una vez.

insert into public.productos (id, nombre, categoria, descripcion, precio, stock, stock_minimo, grupo, orden)
select v.id, v.nombre, 'bebida', v.descripcion, v.precio, v.stock, v.minimo, v.grupo, v.orden
from (values
  ('b-macchiato',  'Macchiato',            'Espresso manchado con espuma de leche',    17, 999, 0, 'Bebidas calientes', 30),
  ('b-mocaccino',  'Mocaccino',            'Espresso, chocolate, leche y crema',       26, 999, 0, 'Bebidas calientes', 31),
  ('b-chocolate',  'Chocolate caliente',   'Chocolate espeso con malvaviscos',         24, 999, 0, 'Bebidas calientes', 32),
  ('b-frappe',     'Frappé de caramelo',   'Café helado con caramelo y crema batida',  30,  40, 5, 'Bebidas frías',     33),
  ('b-cunape',     'Cuñapé',               'Pancitos de almidón y queso, tres unidades', 15, 40, 5, 'Pastelería',       34),
  ('b-empanada',   'Empanada de queso',    'Masa dorada rellena de queso',             12,  40, 5, 'Pastelería',        35),
  ('b-alfajor',    'Alfajor',              'Con dulce de leche y coco rallado',        10,  40, 5, 'Pastelería',        36),
  ('b-galleta',    'Galleta con chispas',  'Horneada, con chispas de chocolate',       10,  40, 5, 'Pastelería',        37)
) as v(id, nombre, descripcion, precio, stock, minimo, grupo, orden)
where not exists (select 1 from public.productos p where lower(p.nombre) = lower(v.nombre))
on conflict (id) do nothing;

create or replace function public.populares_totem()
returns table (producto_id text)
language sql stable security definer set search_path = public
as $$
  select i.producto_id
    from pedido_items i
    join pedidos p    on p.id = i.pedido_id
    join productos pr on pr.id = i.producto_id
   where pr.activo and pr.categoria::text = 'bebida'
     and p.estado <> 'cancelado' and p.creado_en > now() - interval '30 days'
   group by i.producto_id
   order by sum(i.cantidad) desc, i.producto_id
   limit 6;
$$;

revoke all on function public.populares_totem() from public, anon;
grant execute on function public.populares_totem() to authenticated;
