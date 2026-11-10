"use client";

import { useEffect } from "react";
import { useAuth } from "@/store/authStore";
import VentanaCuenta from "./VentanaCuenta";

/** Arranca la sesión de Supabase, monta la ventana de cuenta y muestra sus avisos. */
export default function Sesion() {
  const iniciar = useAuth((s) => s.iniciar);
  const aviso = useAuth((s) => s.aviso);
  const limpiar = useAuth((s) => s.limpiarAviso);

  useEffect(() => iniciar(), [iniciar]);
  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(limpiar, 5000);
    return () => window.clearTimeout(t);
  }, [aviso, limpiar]);

  return (
    <>
      <VentanaCuenta />
      {aviso && (
        <div className="aviso-cuenta" role="status">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M7.5 12.5l3 3 6-6.5" />
          </svg>
          <div>
            <strong>{aviso.titulo}</strong>
            <span>{aviso.texto}</span>
          </div>
          <button type="button" className="aviso-cuenta__cerrar" aria-label="Cerrar aviso" onClick={limpiar}>×</button>
        </div>
      )}
    </>
  );
}
