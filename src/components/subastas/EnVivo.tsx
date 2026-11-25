"use client";
/* eslint-disable @next/next/no-img-element -- export estático: next/image no optimiza aquí */

import { useEffect } from "react";
import { useSubastas } from "@/store/subastasStore";
import { Martillero } from "./Personajes";

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

/** Granos de café que caen al ganar. */
const CONFETI = Array.from({ length: 34 }, (_, k) => ({ x: (k * 37) % 100, d: (k % 9) * 0.16, t: 2.6 + (k % 5) * 0.35, r: (k * 53) % 360, c: k % 4 }));

/** Aviso con su personaje: "Vas primero", "Te superaron" (RF-13) o "¡Ganaste!". */
export function AvisoSubasta() {
  const aviso = useSubastas((s) => s.aviso);
  const setAviso = useSubastas((s) => s.setAviso);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), aviso.tipo === "ganaste" ? 14000 : 7000);
    return () => window.clearTimeout(t);
  }, [aviso, setAviso]);

  if (!aviso) return null;
  if (aviso.tipo === "ganaste")
    return (
      <div className="ganaste" role="alertdialog" aria-label={aviso.titulo} onClick={() => setAviso(null)}>
        <span className="ganaste__confeti" aria-hidden="true">
          {CONFETI.map((g, k) => <i key={k} data-c={g.c} style={{ left: `${g.x}%`, animationDelay: `${g.d}s`, animationDuration: `${g.t}s`, rotate: `${g.r}deg` }} />)}
        </span>
        <div className="ganaste__caja">
          <img src="/subastas/ganador.webp" alt="" width={522} height={560} />
          <strong>{aviso.titulo}</strong>
          <span>{aviso.texto}</span>
          <button type="button" className="btn btn--primary" onClick={() => setAviso(null)}>¡Qué bien!</button>
        </div>
      </div>
    );
  return (
    <div key={aviso.texto} className={`toast toast--personaje${aviso.tipo === "ok" ? " toast--ok" : ""}`} role={aviso.tipo === "ok" ? "status" : "alert"}>
      <span className="toast__personaje">
        {aviso.tipo === "ok" ? <Martillero golpe={1} /> : <img src="/subastas/superado.webp" alt="" width={423} height={560} />}
      </span>
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
