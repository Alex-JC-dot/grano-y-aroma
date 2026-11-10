"use client";

import { useRuta } from "@/lib/ruta";
import Link from "next/link";
import { useAuth } from "@/store/authStore";
import { PANELES } from "@/lib/supabase";

const ENLACES = [
  { href: "/admin", label: "Panel general", detalle: "Ventas y reportes" },
  { href: "/admin/productos", label: "Productos", detalle: "Precios, stock y nuevos" },
  { href: "/admin/subastas", label: "Subastas", detalle: "Publicar y cerrar lotes" },
  { href: "/admin/usuarios", label: "Usuarios", detalle: "Cuentas y roles" },
  { href: "/pos", label: "Caja", detalle: "Venta en la cafetería" },
  { href: "/erp", label: "Bodega y tueste", detalle: "Stock y lotes" },
  { href: "/logistica", label: "Logística", detalle: "Pedidos y entregas" },
];

const NOMBRE_ROL = { cliente: "Cliente", cajero: "Cajero", tostador: "Tostador", admin: "Administrador" } as const;

/** Barra lateral de los paneles internos: solo muestra los que el rol puede abrir. */
export default function MenuEquipo() {
  const ruta = useRuta();
  const { perfil, session, salir } = useAuth();
  const visibles = perfil ? ENLACES.filter((e) => PANELES[perfil.rol].includes(e.href)) : [];

  return (
    <header className="equipo__menu">
      <Link href="/" className="equipo__marca">
        Grano y Aroma
        <span>Equipo</span>
      </Link>
      {visibles.length > 0 && (
        <nav aria-label="Paneles">
          <ul>
            {visibles.map((e) => (
              <li key={e.href}>
                <Link href={e.href} aria-current={ruta === e.href ? "page" : undefined}>
                  <span>{e.label}</span>
                  <small>{e.detalle}</small>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <div className="equipo__pie">
        {session && perfil && (
          <p className="equipo__usuario">
            <strong>{perfil.nombre}</strong>
            <span>{NOMBRE_ROL[perfil.rol]}</span>
          </p>
        )}
        <Link href="/tienda" className="equipo__tienda link">Ver la tienda →</Link>
        {session && (
          <button type="button" className="link equipo__salir" onClick={() => salir()}>Salir</button>
        )}
      </div>
    </header>
  );
}
