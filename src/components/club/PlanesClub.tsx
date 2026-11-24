"use client";
/* eslint-disable @next/next/no-img-element -- export estático: next/image no optimiza aquí */

import { formatBs } from "@/lib/utils";

/**
 * Las tres tarjetas de plan del Club. Son un atajo: cada plan es una combinación de frecuencia y
 * cantidad, y al elegirlo el formulario de abajo queda lleno con ella (el café y la molienda se
 * pueden cambiar ahí). Por eso el precio lo calcula quien las usa, con el café elegido.
 *
 * El personaje sobresale de la tarjeta, flota y parpadea; los granos giran a su alrededor. Todo es
 * CSS sobre tres imágenes (public/club), sin videos.
 */

export type PlanClub = {
  id: "descubre" | "casa" | "barista";
  nombre: string;
  lema: string;
  gramos: 250 | 500 | 1000;
  frecuencia: 15 | 30;
  tazas: number;
  /** Ancho y alto de la imagen, y dónde están los ojos (en % de la imagen) para que parpadee. */
  ancho: number;
  alto: number;
  ojos: { x: number; y: number; w: number; piel: string }[];
};

export const PLANES: PlanClub[] = [
  { id: "descubre", nombre: "Descubre", lema: "Para probar un café nuevo cada mes", gramos: 250, frecuencia: 30, tazas: 15, ancho: 760, alto: 651, ojos: [{ x: 38.5, y: 45.4, w: 4.6, piel: "#e9d4a7" }, { x: 64.4, y: 44.6, w: 4.6, piel: "#c6ae82" }] },
  { id: "casa", nombre: "Casa", lema: "Para que nunca falte el café en casa", gramos: 500, frecuencia: 30, tazas: 30, ancho: 654, alto: 760, ojos: [{ x: 42, y: 33.7, w: 3.7, piel: "#dcc494" }, { x: 51.9, y: 33.3, w: 3.7, piel: "#dabd8e" }] },
  { id: "barista", nombre: "Barista", lema: "Para quien prepara café todos los días", gramos: 1000, frecuencia: 15, tazas: 60, ancho: 636, alto: 760, ojos: [{ x: 63.2, y: 38.8, w: 5, piel: "#e3d2ac" }, { x: 74.9, y: 38.9, w: 5, piel: "#eedaba" }] },
];

const CANTIDAD = { 250: "250 g", 500: "500 g", 1000: "1 kg" } as const;

/** Borde ondulado de las escenas, como chocolate que chorrea. */
export const Onda = () => (
  <svg className="cplan__onda" viewBox="0 0 320 60" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0 22c14 0 18 16 34 16 18 0 18-24 38-24 22 0 18 34 44 38 22 4 66 4 88 0 26-4 22-38 44-38 20 0 20 24 38 24 16 0 20-16 34-16v40H0Z" />
  </svg>
);

const Grano = ({ n }: { n: number }) => (
  <svg className={`cplan__grano cplan__grano--${n}`} viewBox="0 0 24 24" aria-hidden="true">
    <ellipse cx="12" cy="12" rx="7.5" ry="10.5" transform="rotate(28 12 12)" />
    <path d="M15.5 3.5c-4 4-1 7-4 9s-1 5-3.5 7.5" />
  </svg>
);

export function PersonajeClub({ plan, className = "" }: { plan: PlanClub; className?: string }) {
  return (
    <span className={`personaje ${className}`} aria-hidden="true">
      <img src={`/club/${plan.id}.webp`} alt="" width={plan.ancho} height={plan.alto} draggable={false} />
      {plan.ojos.map((o, k) => (
        <i key={k} style={{ left: `${o.x}%`, top: `${o.y}%`, width: `${o.w}%`, background: o.piel }} />
      ))}
    </span>
  );
}

export default function PlanesClub({
  cafe,
  elegido,
  precio,
  alElegir,
}: {
  /** Nombre del café con el que se calculan los precios. */
  cafe: string;
  /** Plan que coincide con lo elegido en el formulario, si hay alguno. */
  elegido: string | null;
  precio: (p: PlanClub) => { tienda: number; club: number };
  /** Se pasa el personaje tocado para que pueda volar hasta el resumen. */
  alElegir: (p: PlanClub, personaje: Element | null) => void;
}) {
  // La tarjeta se inclina hacia el mouse (solo si hay mouse: con el dedo no tiene sentido).
  const inclinar = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--ry", `${((e.clientX - r.left) / r.width - 0.5) * 9}deg`);
    e.currentTarget.style.setProperty("--rx", `${(0.5 - (e.clientY - r.top) / r.height) * 7}deg`);
  };
  const soltar = (e: React.PointerEvent<HTMLElement>) => {
    e.currentTarget.style.removeProperty("--ry");
    e.currentTarget.style.removeProperty("--rx");
  };

  return (
    <ul className="cplanes">
      {PLANES.map((p, i) => {
        const { tienda, club } = precio(p);
        const es = elegido === p.id;
        return (
          <li key={p.id} data-revelar style={{ "--i": i } as React.CSSProperties}>
            <article className={`cplan cplan--${p.id}${es ? " is-on" : ""}`} onPointerMove={inclinar} onPointerLeave={soltar}>
              {p.id === "casa" && <span className="cplan__sello">Recomendado</span>}
              <div className="cplan__escena" aria-hidden="true">
                <span className="cplan__num">{i + 1}</span>
                <span className="cplan__sol" />
                <span className="cplan__orbita"><Grano n={1} /><Grano n={2} /><Grano n={3} /></span>
                <Onda />
              </div>
              <PersonajeClub plan={p} className="cplan__personaje" />

              <div className="cplan__cuerpo">
                <h3>{p.nombre}</h3>
                <p className="cplan__lema">{p.lema}</p>
                <svg className="cplan__zigzag" viewBox="0 0 92 8" aria-hidden="true"><path d="M1 6l5-4 5 4 5-4 5 4 5-4 5 4 5-4 5 4 5-4 5 4 5-4 5 4 5-4 5 4 5-4 5 4 5-4" /></svg>
                <ul className="cplan__lista">
                  <li><strong>{CANTIDAD[p.gramos]}</strong> cada {p.frecuencia} días</li>
                  <li>Unas {p.tazas} tazas por envío</li>
                  <li>{p.frecuencia === 15 ? 15 : 10} % menos que en la tienda</li>
                  <li>Envío sin costo en Sucre</li>
                </ul>
                <p className="cplan__precio">
                  <s>{formatBs(tienda)}</s>
                  <strong>{formatBs(club)}</strong>
                  <small>por envío · {cafe}</small>
                </p>
              </div>
              <button type="button" className="cplan__boton" aria-pressed={es} onClick={(e) => alElegir(p, e.currentTarget.parentElement!.querySelector(".cplan__personaje"))}>
                {es ? "Elegido ✓" : `Elegir ${p.nombre}`}
              </button>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
