"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCartStore } from "@/store/cartStore";

const ENLACES = [
  { href: "/tienda", label: "Tienda" },
  { href: "/nosotros", label: "Nosotros" },
  { href: "/club", label: "Club" },
  { href: "/subastas", label: "Subastas" },
  { href: "#contacto", label: "Contáctanos" }, // la sección está en el pie de todas las páginas
];

/** Barra: la marca a la izquierda, los enlaces al centro y carrito + "Comprar café" a la derecha. */
export default function NavInicio() {
  const cantidad = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const abrirCarrito = useCartStore((s) => s.toggleCart);
  const ruta = usePathname();
  const [menu, setMenu] = useState(false);
  const esActual = (href: string) => href.startsWith("/") && (ruta === href || ruta.startsWith(href + "/"));

  // Cierra el menú del celular al cambiar de página o con Escape.
  useEffect(() => {
    if (!menu) return;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [menu]);

  const enlace = (e: (typeof ENLACES)[number]) =>
    e.href.startsWith("#") ? (
      <a href={e.href} className="link" onClick={() => setMenu(false)}>
        {e.label}
      </a>
    ) : (
      <Link href={e.href} className="link" aria-current={esActual(e.href) ? "page" : undefined} onClick={() => setMenu(false)}>
        {e.label}
      </Link>
    );

  return (
    <header className={`nav${menu ? " is-menu" : ""}`}>
      <div className="wrap nav__row">
        <a className="skip-link" href="#contenido">
          Saltar al contenido
        </a>
        <Link href="/" className="nav__brand">
          Grano y Aroma
        </Link>
        <nav aria-label="Principal" className="nav__centro">
          <ul className="nav__links">
            {ENLACES.map((e) => (
              <li key={e.href}>{enlace(e)}</li>
            ))}
          </ul>
        </nav>
        <div className="nav__actions">
          <button
            type="button"
            className="cart-btn"
            onClick={abrirCarrito}
            aria-label={cantidad ? `Abrir carrito, ${cantidad} productos` : "Abrir carrito"}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 7h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 7Zm4 0V6a3 3 0 0 1 6 0v1" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            {cantidad > 0 && <span className="cart-btn__count">{cantidad}</span>}
          </button>
          <Link href="/tienda" className="btn btn--primary nav__comprar">
            Comprar café
          </Link>
          <button
            type="button"
            className="cart-btn nav__toggle"
            aria-expanded={menu}
            aria-controls="menu-movil"
            aria-label={menu ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setMenu((m) => !m)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              {menu ? (
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.6" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.6" />
              )}
            </svg>
          </button>
        </div>
      </div>

      <nav id="menu-movil" className="nav__movil" aria-label="Principal" hidden={!menu}>
        <ul>
          {ENLACES.map((e) => (
            <li key={e.href}>{enlace(e)}</li>
          ))}
          <li>
            <Link href="/tienda" className="btn btn--primary" onClick={() => setMenu(false)}>
              Comprar café
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
