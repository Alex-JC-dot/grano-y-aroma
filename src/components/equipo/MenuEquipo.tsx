"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ENLACES = [
  { href: "/admin", label: "Panel general", detalle: "Ventas y reportes" },
  { href: "/pos", label: "Caja", detalle: "Venta en la cafetería" },
  { href: "/erp", label: "Bodega y tueste", detalle: "Stock y lotes" },
  { href: "/logistica", label: "Logística", detalle: "Pedidos y entregas" },
];

/** Barra lateral de los paneles internos (arriba en celular). */
export default function MenuEquipo() {
  const ruta = usePathname();
  return (
    <header className="equipo__menu">
      <Link href="/" className="equipo__marca">
        Grano y Aroma
        <span>Equipo</span>
      </Link>
      <nav aria-label="Paneles">
        <ul>
          {ENLACES.map((e) => (
            <li key={e.href}>
              <Link href={e.href} aria-current={ruta === e.href ? "page" : undefined}>
                <span>{e.label}</span>
                <small>{e.detalle}</small>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <Link href="/tienda" className="equipo__tienda link">
        Ver la tienda →
      </Link>
    </header>
  );
}
