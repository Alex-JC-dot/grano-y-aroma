"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCartStore } from "@/store/cartStore";

const ENLACES = [
  { href: "/tienda", label: "Tienda" },
  { href: "/nosotros", label: "Nosotros" },
  { href: "/club", label: "Club" },
  { href: "/subastas", label: "Subastas" },
];

export default function NavInicio() {
  const cantidad = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const abrirCarrito = useCartStore((s) => s.toggleCart);
  const ruta = usePathname();
  const esActual = (href: string) => ruta === href || ruta.startsWith(href + "/");

  return (
    <header className="nav">
      <div className="wrap nav__row">
        <a className="skip-link" href="#contenido">
          Saltar al contenido
        </a>
        <Link href="/" className="nav__brand">
          Grano y Aroma
        </Link>
        <nav aria-label="Principal">
          <ul className="nav__links">
            {ENLACES.map((e) => (
              <li key={e.href}>
                <Link href={e.href} className="link" aria-current={esActual(e.href) ? "page" : undefined}>
                  {e.label}
                </Link>
              </li>
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
              <path
                d="M5 7h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 7Zm4 0V6a3 3 0 0 1 6 0v1"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
            {cantidad > 0 && <span className="cart-btn__count">{cantidad}</span>}
          </button>
          <Link href="/tienda" className="btn btn--primary">
            Comprar café
          </Link>
        </div>
      </div>
    </header>
  );
}
