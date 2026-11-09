"use client";

import { useEffect } from "react";
import { useSubastas } from "@/store/subastasStore";

/** Conecta la página a las subastas en vivo y mueve el reloj cada segundo. */
export function useSubastasEnVivo() {
  const conectar = useSubastas((s) => s.conectar);
  const tick = useSubastas((s) => s.tick);
  useEffect(() => conectar(), [conectar]);
  useEffect(() => {
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [tick]);
}

/** Aviso flotante: "Vas primero" o "Te superaron" (RF-13). */
export function AvisoSubasta() {
  const aviso = useSubastas((s) => s.aviso);
  const setAviso = useSubastas((s) => s.setAviso);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 7000);
    return () => window.clearTimeout(t);
  }, [aviso, setAviso]);

  if (!aviso) return null;
  return (
    <div className={`toast${aviso.tipo === "ok" ? " toast--ok" : ""}`} role={aviso.tipo === "ok" ? "status" : "alert"}>
      <strong>{aviso.titulo}</strong>
      <span>{aviso.texto}</span>
      <button type="button" className="toast__cerrar" aria-label="Cerrar aviso" onClick={() => setAviso(null)}>×</button>
    </div>
  );
}

/** "2 d 5 h 03 min", "3h 05m" o "04:59". */
export function tiempo(seg: number) {
  const d = Math.floor(seg / 86400);
  const h = Math.floor((seg % 86400) / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = seg % 60;
  if (d > 0) return `${d} d ${h} h ${String(m).padStart(2, "0")} min`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export const horaDe = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", hour12: false });
