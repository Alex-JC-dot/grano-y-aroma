"use client";

import { useId } from "react";

/**
 * Los gatitos de la cuenta: un dibujo propio en cuatro colores. El elegido se guarda con los datos
 * de la cuenta en Supabase Auth (user_metadata.avatar), así que no necesita una tabla nueva.
 */
export const GATITOS = {
  gris: { nombre: "Gris", fondo: "#ead3b5", pelo: "#8d8a8c", sombra: "#777477", hocico: "#b7b3b3", oreja: "#e3aa9f", ojo: "#f3d27a", raya: "#6d6a6d" },
  blanco: { nombre: "Blanco", fondo: "#7a4a2c", pelo: "#fbf4ea", sombra: "#e9dccb", hocico: "#ffffff", oreja: "#f0b4a6", ojo: "#8fc3d9", raya: "" },
  negro: { nombre: "Negro", fondo: "#d39a6a", pelo: "#1f1916", sombra: "#120e0c", hocico: "#2e2622", oreja: "#8a5a52", ojo: "#f6c453", raya: "" },
  naranja: { nombre: "Naranja", fondo: "#5f6b3a", pelo: "#e8924a", sombra: "#d57c35", hocico: "#fbe3c6", oreja: "#f4b7a0", ojo: "#bfe08a", raya: "#c2681f" },
} as const;
export type Gato = keyof typeof GATITOS;
export const esGato = (x: unknown): x is Gato => typeof x === "string" && x in GATITOS;

export default function Gatito({ gato, className = "" }: { gato: Gato; className?: string }) {
  const id = useId().replace(/:/g, "");
  const g = GATITOS[gato];
  return (
    <svg className={`gatito ${className}`} viewBox="0 0 100 100" role="img" aria-label={`Gatito ${g.nombre.toLowerCase()}`}>
      <clipPath id={id}><circle cx="50" cy="50" r="50" /></clipPath>
      <g clipPath={`url(#${id})`}>
        <rect width="100" height="100" fill={g.fondo} />
        {/* Cuerpo */}
        <path d="M30 104c0-19 6-30 20-30s20 11 20 30z" fill={g.sombra} />
        <path d="M41 104c0-13 3-20 9-20s9 7 9 20z" fill={g.hocico} />
        {/* Orejas */}
        <path d="M21 46c-3-14-2-25 1-30 1-2 4-2 6 0 6 4 12 10 15 16z" fill={g.pelo} />
        <path d="M79 46c3-14 2-25-1-30-1-2-4-2-6 0-6 4-12 10-15 16z" fill={g.pelo} />
        <path d="M26 38c-1-8-1-13 0-16 4 3 8 7 10 11z" fill={g.oreja} />
        <path d="M74 38c1-8 1-13 0-16-4 3-8 7-10 11z" fill={g.oreja} />
        {/* Cabeza */}
        <path d="M50 29c21 0 33 11 33 26 0 16-14 26-33 26S17 71 17 55c0-15 12-26 33-26z" fill={g.pelo} />
        {g.raya && (
          <g fill="none" stroke={g.raya} strokeWidth="3.4" strokeLinecap="round">
            <path d="M50 32v8M42 33.5l1.2 6M58 33.5l-1.2 6" />
            <path d="M18.5 59l6 .6M20 66l5.4-1.2M81.5 59l-6 .6M80 66l-5.4-1.2" />
          </g>
        )}
        <ellipse cx="50" cy="68.5" rx="13" ry="9.5" fill={g.hocico} />
        {/* Ojos */}
        <g className="gatito__ojos">
          <circle cx="35" cy="54" r="10.5" fill="#fffaf2" />
          <circle cx="65" cy="54" r="10.5" fill="#fffaf2" />
          <g className="gatito__mirada">
            <circle cx="36" cy="54.6" r="8.4" fill={g.ojo} />
            <circle cx="64" cy="54.6" r="8.4" fill={g.ojo} />
            <circle cx="36.4" cy="54.8" r="6" fill="#17110e" />
            <circle cx="63.6" cy="54.8" r="6" fill="#17110e" />
            <circle cx="38.6" cy="52" r="2.1" fill="#fff" />
            <circle cx="65.8" cy="52" r="2.1" fill="#fff" />
          </g>
        </g>
        {/* Nariz, boca y bigotes */}
        <path d="M47.2 63.6h5.6c1 0 1.4 1 .8 1.7l-2.5 2.6c-.6.6-1.6.6-2.2 0l-2.5-2.6c-.6-.7-.2-1.7.8-1.7z" fill="#e0887b" />
        <path d="M50 68.4v2.2m0 0c-1 2.4-4.4 2.8-6 .8m6-.8c1 2.4 4.4 2.8 6 .8" fill="none" stroke={gato === "negro" ? "#8d7a70" : "#5a4036"} strokeWidth="1.6" strokeLinecap="round" />
        <g fill="none" stroke={gato === "negro" ? "#6b5b53" : "#5a4036"} strokeOpacity={gato === "negro" ? 1 : 0.55} strokeWidth="1.4" strokeLinecap="round">
          <path d="M32 69l-13-2M32.500 72.500l-12 2M68 69l13-2M67.500 72.500l12 2" />
        </g>
      </g>
    </svg>
  );
}

/** Los cuatro, para elegir uno. */
export function ElegirGatito({ valor, alElegir, titulo = "Elige tu gatito", deshabilitado = false }: { valor: Gato | null; alElegir: (g: Gato) => void; titulo?: string; deshabilitado?: boolean }) {
  const nombre = useId();
  return (
    <fieldset className="gatitos" disabled={deshabilitado}>
      <legend>{titulo}</legend>
      <div className="gatitos__fila">
        {(Object.keys(GATITOS) as Gato[]).map((g) => (
          <label key={g} className={`gatitos__opcion${valor === g ? " is-on" : ""}`} title={GATITOS[g].nombre}>
            <input type="radio" name={nombre} value={g} checked={valor === g} onChange={() => alElegir(g)} aria-label={`Gatito ${GATITOS[g].nombre.toLowerCase()}`} />
            <Gatito gato={g} />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
