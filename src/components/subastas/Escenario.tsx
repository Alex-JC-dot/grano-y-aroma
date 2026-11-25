"use client";
/* eslint-disable @next/next/no-img-element -- export estático: next/image no optimiza aquí */

import { abierta, nombreCorto, segundosA, useSubastas } from "@/store/subastasStore";
import { formatBs } from "@/lib/utils";
import { tiempo } from "./EnVivo";

/**
 * El banner de las subastas, de lado a lado y pegado al menú. Sobre el podio se ve la puja más
 * alta; cuando entra una puja en cualquier lote (la trae Realtime), se anuncia ahí mismo.
 */

const ANUNCIO = 7000; // lo que dura el anuncio de una puja
const corto = (n: number) => formatBs(n).replace(/[.,]00$/, "");

export default function Escenario() {
  const { subastas, ahora, ultima } = useSubastas();
  const vivas = subastas.filter((s) => abierta(s, ahora));
  const pujas = vivas.reduce((n, s) => n + s.num_pujas, 0);
  const proxima = [...vivas].sort((a, b) => a.cierra_en.localeCompare(b.cierra_en))[0];
  const lider = vivas.reduce<(typeof vivas)[number] | null>((m, s) => (s.puja_actual && s.puja_actual > (m?.puja_actual ?? 0) ? s : m), null);
  const anuncio = ultima && ahora - ultima.cuando < ANUNCIO ? ultima : null;

  // Arriba, el monto y abajo del cartel: la puja que entró, la más alta o la salida más baja.
  const cartel = anuncio
    ? [anuncio.postor === "Tu puja" ? "Tu puja" : `${anuncio.postor} puja`, corto(anuncio.monto), `por ${nombreCorto(anuncio.titulo)}`]
    : lider
      ? ["Puja más alta", corto(lider.puja_actual ?? 0), nombreCorto(lider.titulo)]
      : ["Sé la primera puja", corto(Math.min(...vivas.map((s) => s.precio_base))), "precio de salida"];

  return (
    <section className="escenario" aria-labelledby="subastas-titulo">
      <img className="escenario__fondo" src="/subastas/banner.webp" alt="" width={1696} height={820} />
      <div className="wrap">
        <div className="escenario__texto">
          <p className="eyebrow"><span className="en-vivo" aria-hidden="true" /> Subastas en vivo</p>
          <h1 id="subastas-titulo">Micro-lotes de Chuquisaca</h1>
          <p className="escenario__lead">Lotes únicos, directo de las fincas. Puja desde tu celular y mira en vivo quién va primero.</p>
          <dl className="escenario__datos">
            <div><dt>{vivas.length === 1 ? "lote en vivo" : "lotes en vivo"}</dt><dd>{vivas.length}</dd></div>
            <div><dt>{pujas === 1 ? "puja" : "pujas"}</dt><dd>{pujas}</dd></div>
            {proxima && <div><dt>cierra el primero</dt><dd>{tiempo(segundosA(proxima.cierra_en, ahora))}</dd></div>}
          </dl>
        </div>
      </div>
      {vivas.length > 0 && (
        <p key={anuncio?.cuando ?? "fijo"} className={`escenario__marcador${anuncio ? " is-puja" : ""}`} aria-live="polite">
          <span>{cartel[0]}</span>
          <strong>{cartel[1]}</strong>
          <span>{cartel[2]}</span>
        </p>
      )}
    </section>
  );
}
