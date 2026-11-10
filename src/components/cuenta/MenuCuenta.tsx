"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/store/authStore";
import { PANELES } from "@/lib/supabase";
import { useRuta } from "@/lib/ruta";

/**
 * Cuenta en la barra: sin sesión, un botón "Login" con borde que lleva a /login (y vuelve aquí); con
 * sesión, la inicial con su menú. Las acciones que guardan datos también piden la cuenta solas.
 */
export default function MenuCuenta() {
  const session = useAuth((s) => s.session);
  const perfil = useAuth((s) => s.perfil);
  const salir = useAuth((s) => s.salir);
  const cargando = useAuth((s) => s.cargando);
  const ruta = useRuta();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setAbierto(false);
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto]);

  if (!session) {
    if (cargando) return null;
    return (
      <Link
        href={ruta === "/" || ruta.startsWith("/login") ? "/login/" : `/login/?volver=${encodeURIComponent(ruta + "/")}`}
        className="menu-cuenta__entrar"
        aria-label="Login"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4.4 3.6-7.5 8-7.5s8 3.1 8 7.5" />
        </svg>
        <span className="menu-cuenta__texto">Login</span>
      </Link>
    );
  }
  const nombre = perfil?.nombre || session.user.email?.split("@")[0] || "Mi cuenta";
  const panel = perfil ? PANELES[perfil.rol][0] : undefined;

  return (
    <div className="menu-cuenta" ref={ref}>
      <button
        type="button"
        className="cart-btn menu-cuenta__boton"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label={`Cuenta de ${nombre}`}
        onClick={() => setAbierto((a) => !a)}
      >
        <span aria-hidden="true">{nombre.charAt(0).toUpperCase()}</span>
      </button>
      {abierto && (
        <div className="menu-cuenta__panel" role="menu">
          <p className="menu-cuenta__quien">
            <strong>{nombre}</strong>
            <span>{session.user.email}</span>
          </p>
          <Link href="/cuenta" role="menuitem" onClick={() => setAbierto(false)}>Mi cuenta</Link>
          {panel && (
            <Link href={panel} role="menuitem" onClick={() => setAbierto(false)}>Panel del equipo</Link>
          )}
          <button type="button" role="menuitem" onClick={() => { setAbierto(false); salir(); }}>Salir</button>
        </div>
      )}
    </div>
  );
}
