"use client";
/* eslint-disable @next/next/no-img-element -- export estático: next/image no optimiza aquí */

import { Onda } from "./PlanesClub";
import { colorDe } from "@/lib/catalogo";
import { formatBs } from "@/lib/utils";
import type { Product } from "@/lib/types";

/**
 * Las opciones de "Personaliza tu plan", con el mismo diseño que las tarjetas de plan: una escena
 * de color con borde ondulado y algo que sobresale (la bolsita de cada café, con la franja de su
 * color). Son botones: lo elegido lo guarda Club.tsx.
 */

/**
 * La bolsita del Club. La imagen tiene la franja calada (solo quedan sus luces y sombras) y detrás
 * va el color del café con la forma exacta de la franja: una imagen sirve para cualquier café.
 */
function Bolsita({ color, texto }: { color: string; texto?: string }) {
  return (
    <span className="bolsita" style={{ "--franja": color } as React.CSSProperties}>
      <span className="bolsita__franja" />
      <img src="/club/bolsita.webp" alt="" draggable={false} />
      <i style={{ left: "26.7%", top: "31.1%" }} />
      <i style={{ left: "64.3%", top: "31.9%" }} />
      {texto && <b className={texto.length === 1 ? "is-signo" : ""}>{texto}</b>}
    </span>
  );
}

type Opcion = { activa: boolean; alElegir: () => void };

export function OpcionFrecuencia({ dias, descuento, activa, alElegir }: { dias: 15 | 30; descuento: number } & Opcion) {
  return (
    <button type="button" className={`copc copc--frec copc--d${dias}${activa ? " is-on" : ""}`} aria-pressed={activa} onClick={alElegir}>
      <span className="copc__escena" aria-hidden="true">
        <span className="copc__num">{dias}</span>
        <Onda />
      </span>
      <span className="copc__texto">
        <strong>Cada {dias} días</strong>
        <small>{dias === 15 ? "Dos envíos al mes" : "Un envío al mes"}</small>
        <em>{descuento} % menos que en la tienda</em>
      </span>
    </button>
  );
}

export function OpcionCantidad({ gramos, etiqueta, activa, alElegir }: { gramos: number; etiqueta: string } & Opcion) {
  const bolsas = gramos / 250;
  return (
    <button type="button" className={`copc copc--cant${activa ? " is-on" : ""}`} aria-pressed={activa} onClick={alElegir}>
      <span className="copc__escena" aria-hidden="true"><Onda /></span>
      <span className="copc__bolsas" data-n={bolsas} aria-hidden="true">
        {Array.from({ length: bolsas }, (_, k) => <Bolsita key={k} color={["#94492a", "#b06a35", "#5d6b35", "#3b1d14"][k]} />)}
      </span>
      <span className="copc__texto">
        <strong>{etiqueta}</strong>
        <small>unas {Math.round(gramos / 16.6)} tazas</small>
      </span>
    </button>
  );
}

export function OpcionCafe({ cafe, activa, alElegir }: { cafe: Product } & Opcion) {
  return (
    <button type="button" className={`copc copc--cafe${activa ? " is-on" : ""}`} aria-pressed={activa} onClick={alElegir} style={{ "--cc": colorDe(cafe) } as React.CSSProperties}>
      <span className="copc__escena" aria-hidden="true"><Onda /></span>
      <span className="copc__bolsa" aria-hidden="true"><Bolsita color={colorDe(cafe)} texto={cafe.name} /></span>
      <span className="copc__texto">
        <strong>{cafe.name}</strong>
        <small>{cafe.region}</small>
        <em>{formatBs(cafe.price)} <i>los 250 g</i></em>
      </span>
    </button>
  );
}

export function OpcionSorpresa({ precio, colores, activa, alElegir }: { precio: number; colores: string[] } & Opcion) {
  return (
    <button type="button" className={`copc copc--sorpresa${activa ? " is-on" : ""}`} aria-pressed={activa} onClick={alElegir}>
      <span className="copc__texto">
        <strong>Sorpresa del tostador</strong>
        <small>Un café distinto en cada envío, elegido de los lotes recién tostados.</small>
        <em>{formatBs(precio)} <i>los 250 g</i></em>
      </span>
      <span className="copc__abanico" aria-hidden="true">
        {colores.slice(0, 3).map((c, k) => <Bolsita key={k} color={c} texto="?" />)}
      </span>
    </button>
  );
}

const ICONOS: Record<string, React.ReactNode> = {
  "Grano entero": <><ellipse cx="24" cy="24" rx="11" ry="16" transform="rotate(28 24 24)" /><path d="M30 10.500c-6 6-2 11-6 14s-2 8-6 12" /></>,
  Espresso: <><path d="M11 19h22v7c0 7-4 11-11 11s-11-4-11-11Z" /><path d="M33 21h3a5 5 0 0 1 0 10h-4" /><path d="M8 41h28" /><path d="M18 7c-2 3 2 4 0 7M26 7c-2 3 2 4 0 7" /></>,
  V60: <><path d="M9 9h30l-9 16H18Z" /><path d="M15 25h18M19 25c-6 4-8 8-8 14h26c0-6-2-10-8-14" /><path d="M14 33h20" /></>,
  "Prensa francesa": <><path d="M14 14h20v26H14Z" /><path d="M34 18h3a4 4 0 0 1 4 4v7a4 4 0 0 1-4 4h-3" /><path d="M24 4v10M19 5h10M11 14h26M14 26h20" /></>,
  Moka: <><path d="M17 22l-3 18h20l-3-18ZM16 22l-3-12h20l-2 12Z" /><path d="M13 10l4-4h12l4 4M23 6V3M33 12h5v10M13 12l-4 3" /></>,
};

export function OpcionMolienda({ nombre, activa, alElegir }: { nombre: string } & Opcion) {
  return (
    <button type="button" className={`copc copc--mol${activa ? " is-on" : ""}`} aria-pressed={activa} onClick={alElegir}>
      <svg viewBox="0 0 48 48" aria-hidden="true">{ICONOS[nombre]}</svg>
      <span>{nombre}</span>
    </button>
  );
}
