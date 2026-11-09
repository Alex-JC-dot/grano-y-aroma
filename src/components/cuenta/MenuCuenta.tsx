"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/store/authStore";
import { PANELES } from "@/lib/supabase";

/**
 * Ícono de cuenta en la barra. Solo aparece cuando hay sesión (antes no se ofrece entrar:
 * la cuenta se pide cuando una acción la necesita).
 */
export default function MenuCuenta() {
  const session = useAuth((s) => s.session);
  const perfil = useAuth((s) => s.perfil);
  const salir = useAuth((s) => s.salir);
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

  if (!session) return null;
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
