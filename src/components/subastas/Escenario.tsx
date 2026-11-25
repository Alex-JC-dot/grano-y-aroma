"use client";
/* eslint-disable @next/next/no-img-element -- export estático: next/image no optimiza aquí */

import { abierta, nombreCorto, segundosA, useSubastas } from "@/store/subastasStore";
import { formatBs } from "@/lib/utils";
import { Martillero } from "./Personajes";
import { tiempo } from "./EnVivo";

/**
 * El banner de las subastas: un escenario con el martillero. Cuando entra una puja en cualquier
 * lote (la trae Realtime), da el martillazo y la anuncia; el resto del tiempo anima la sala.
 */

const ANUNCIO = 7000; // lo que dura el anuncio de una puja

export default function Escenario() {
  const { subastas, ahora, ultima } = useSubastas();
  const vivas = subastas.filter((s) => abierta(s, ahora));
  const pujas = vivas.reduce((n, s) => n + s.num_pujas, 0);
  const proxima = vivas[0]; // vienen ordenadas por cierre
  const mayor = vivas.reduce((m, s) => Math.max(m, s.puja_actual ?? 0), 0);

  const anunciando = ultima && ahora - ultima.cuando < ANUNCIO;
  const frases = [
    "¿Quién da más?",
    ...(proxima ? [`${nombreCorto(proxima.titulo)} cierra en ${tiempo(segundosA(proxima.cierra_en, ahora))}`] : []),
    mayor ? `La puja más alta va en ${formatBs(mayor)}` : "¡Sé la primera puja!",
    "Café único: cuando se vende, no vuelve",
  ];
  const frase = vivas.length ? frases[Math.floor(ahora / 5000) % frases.length] : "Pronto abrimos otra subasta";

  return (
    <div className="escenario">
      <img className="escenario__fondo" src="/subastas/banner.webp" alt="" width={1696} height={820} />
      <div className="escenario__texto">
        <p className="eyebrow"><span className="en-vivo" aria-hidden="true" /> Subastas en vivo</p>
        <h1 id="subastas-titulo">Micro-lotes de Chuquisaca</h1>
        <p className="escenario__lead">Lotes únicos, directo de las fincas. Puja desde tu celular y mira en vivo quién va primero.</p>
        <dl className="escenario__datos">
          <div><dt>{vivas.length === 1 ? "lote en vivo" : "lotes en vivo"}</dt><dd>{vivas.length}</dd></div>
          <div><dt>{pujas === 1 ? "puja" : "pujas"}</dt><dd>{pujas}</dd></div>
          <div><dt>puja más alta</dt><dd>{mayor ? formatBs(mayor).replace(/[.,]00$/, "") : "—"}</dd></div>
        </dl>
      </div>
      <div className="escenario__actor">
        <p key={anunciando ? ultima.cuando : frase} className={`escenario__globo${anunciando ? " is-puja" : ""}`} aria-live="polite">
          {anunciando ? (
            <>
              <strong>¡{formatBs(ultima.monto).replace(/[.,]00$/, "")}!</strong>
              <span>{ultima.postor === "Tu puja" ? "Tu puja" : `${ultima.postor} puja`} por {nombreCorto(ultima.titulo)}</span>
            </>
          ) : (
            frase
          )}
        </p>
        <Martillero golpe={ultima?.cuando ?? 0} />
      </div>
    </div>
  );
}
