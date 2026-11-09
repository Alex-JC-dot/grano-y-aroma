"use client";

import Link from "next/link";
import { useCartStore } from "@/store/cartStore";

const ENLACES = [
  { href: "#cafes", label: "Cafés" },
  { href: "#tueste", label: "Tueste" },
  { href: "/club", label: "Club" },
  { href: "/subastas", label: "Subastas" },
  { href: "#visita", label: "Visita" },
];

export default function NavInicio() {
  const cantidad = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const abrirCarrito = useCartStore((s) => s.toggleCart);

  return (
    <header className="nav">
      <div className="wrap nav__row">
        <a className="skip-link" href="#contenido">
          Saltar al contenido
        </a>
        <a href="#top" className="nav__brand">
          Grano y Aroma
        </a>
        <nav aria-label="Principal">
          <ul className="nav__links">
            {ENLACES.map((e) => (
              <li key={e.href}>
                {e.href.startsWith("/") ? (
                  <Link href={e.href} className="link">
                    {e.label}
                  </Link>
                ) : (
                  <a href={e.href} className="link">
                    {e.label}
                  </a>
                )}
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
          <a href="#cafes" className="btn btn--primary">
            Comprar café
          </a>
        </div>
      </div>
    </header>
  );
}
