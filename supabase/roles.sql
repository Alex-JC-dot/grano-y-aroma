-- =====================================================================
-- Asignar roles a las cuentas del equipo.
-- 1) Crea las cuentas: desde la web (Crear cuenta) o en Supabase →
--    Authentication → Users → Add user (marca "Auto Confirm User").
-- 2) Ejecuta esto en el SQL Editor cambiando los correos si hace falta.
--    (Corre como administrador de la base, por eso puede cambiar roles.)
-- =====================================================================
alter table public.perfiles disable trigger proteger_rol;

update public.perfiles set rol = 'admin'
  where id = (select id from auth.users where email = 'alexcalatayud9@gmail.com');
update public.perfiles set rol = 'cajero', nombre = 'María Cajera'
  where id = (select id from auth.users where email = 'cajero@granoyaroma.test');
update public.perfiles set rol = 'tostador', nombre = 'Jorge Tostador'
  where id = (select id from auth.users where email = 'tostador@granoyaroma.test');

alter table public.perfiles enable trigger proteger_rol;

select u.email, p.nombre, p.rol from public.perfiles p join auth.users u on u.id = p.id order by p.rol;
