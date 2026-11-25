"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/store/authStore";
import { abierta, minimoDe, nombreCorto, segundosA, useSubastas, type Puja, type Subasta } from "@/store/subastasStore";
import { formatBs } from "@/lib/utils";

/**
 * Piezas de una subasta en vivo que comparten la lista y la ficha del lote: el reloj de cuatro
 * bloques, el monto que sube contando, el podio y los botones para pujar de un toque.
 */

const dos = (n: number) => String(n).padStart(2, "0");

export function Reloj({ hasta, ahora, texto }: { hasta: string; ahora: number; texto: string }) {
  const s = segundosA(hasta, ahora);
  const bloques: [number, string][] = [
    [Math.floor(s / 86400), "días"],
    [Math.floor((s % 86400) / 3600), "horas"],
    [Math.floor((s % 3600) / 60), "min"],
    [s % 60, "seg"],
  ];
  return (
    <div className={`reloj${s < 3600 ? " is-urgente" : ""}`} role="timer" aria-label={`${texto} ${bloques.map(([n, u]) => `${n} ${u}`).join(" ")}`}>
      {bloques.map(([n, u]) => (
        <span key={u} aria-hidden="true">
          <strong>{dos(n)}</strong>
          <small>{u}</small>
        </span>
      ))}
    </div>
  );
}

/** El monto actual: cuando sube, cuenta desde el anterior. */
export function MontoVivo({ valor }: { valor: number }) {
  const span = useRef<HTMLSpanElement>(null);
  const visto = useRef(valor);
  useEffect(() => {
    const desde = visto.current;
    visto.current = valor;
    const el = span.current;
    if (!el || desde === valor || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const inicio = performance.now();
    let cuadro = 0;
    const paso = (t: number) => {
      const k = Math.min(1, (t - inicio) / 900);
      el.textContent = formatBs(k < 1 ? Math.round(desde + (valor - desde) * (1 - Math.pow(1 - k, 3))) : valor);
      if (k < 1) cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    el.closest(".puja-actual")?.animate([{ transform: "scale(1)" }, { transform: "scale(1.05)" }, { transform: "scale(1)" }], { duration: 500, easing: "ease-out" });
    return () => cancelAnimationFrame(cuadro);
  }, [valor]);
  return <span ref={span}>{formatBs(valor)}</span>;
}

const SIN_PUJAS: Puja[] = [];

/** Los tres mejores postores. Si alguien pasa adelante, los puestos se intercambian con movimiento. */
export function Podio({ id }: { id: number }) {
  const pujas = useSubastas((s) => s.pujas[id] ?? SIN_PUJAS);
  const mejores: Puja[] = [];
  for (const p of [...pujas].sort((a, b) => b.monto - a.monto))
    if (mejores.length < 3 && !mejores.some((m) => m.postor === p.postor && m.es_mia === p.es_mia)) mejores.push(p);
  if (!mejores.length)
    return (
      <p className="podio podio--vacio">
        <strong>Nadie pujó todavía</strong>
        <span>El primer puesto puede ser tuyo.</span>
      </p>
    );
  return (
    <ol className="podio" aria-label="Los mejores postores">
      {mejores.map((p, k) => (
        <li key={`${p.postor}|${p.es_mia}`} className={`podio__puesto podio__puesto--${k + 1}${p.es_mia ? " es-mia" : ""}`}>
          {k === 0 && (
            <svg viewBox="0 0 32 22" className="podio__corona" aria-hidden="true"><path d="M3 19 1 5l8 6 7-10 7 10 8-6-2 14Z" /></svg>
          )}
          <span className="podio__cara" aria-hidden="true">{(p.es_mia ? "T" : p.postor.trim()[0] ?? "?").toUpperCase()}</span>
          <strong>{p.es_mia ? "Tú" : p.postor}</strong>
          <small>{formatBs(p.monto)}</small>
          <span className="podio__base" aria-hidden="true">{k + 1}</span>
        </li>
      ))}
    </ol>
  );
}

/** Elegir cuánto pujar con botones y pujar de un toque. */
export default function PanelPuja({ lote }: { lote: Subasta }) {
  const ahora = useSubastas((s) => s.ahora);
  const registrar = useSubastas((s) => s.pujar);
  const setAviso = useSubastas((s) => s.setAviso);
  const pedirCuenta = useAuth((s) => s.pedirCuenta);
  const yo = useAuth((s) => s.session?.user.id);
  const [elegido, setElegido] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const minimo = minimoDe(lote);
  const monto = Math.max(minimo, elegido); // si alguien pujó, el mínimo sube y el monto con él
  const voyPrimero = !!yo && lote.lider_id === yo;

  if (!abierta(lote, ahora)) {
    const ganador = lote.ganador_nombre ?? lote.lider_nombre;
    return (
      <p className="lote__resultado">
        {ganador ? `Ganó ${voyPrimero ? "tu puja" : ganador} con ${formatBs(lote.puja_actual ?? 0)}.` : "Cerró sin pujas: el lote no se adjudicó."}
      </p>
    );
  }
  if (voyPrimero)
    return (
      <p className="panel-puja__primero" role="status">
        <strong>¡Vas primero!</strong>
        <span>Con {formatBs(lote.puja_actual ?? 0)}. Te avisamos si alguien te supera.</span>
      </p>
    );

  const pujar = async () => {
    setError("");
    if (!(await pedirCuenta("Para pujar necesitas una cuenta. Tu monto se mantiene."))) return;
    setEnviando(true);
    const fallo = await registrar(lote.id, monto);
    setEnviando(false);
    if (fallo) return setError(fallo);
    setElegido(0);
    setAviso({ tipo: "ok", titulo: "¡Vas primero!", texto: `Tu puja de ${formatBs(monto)} va primera en ${nombreCorto(lote.titulo)}.` });
  };

  return (
    <div className="panel-puja">
      <div className="panel-puja__sumas" role="group" aria-label="Subir tu puja">
        {[1, 2, 5].map((n) => (
          <button key={n} type="button" onClick={() => setElegido(monto + lote.incremento * n)} disabled={enviando}>
            +{(lote.incremento * n).toLocaleString("es-BO")}
          </button>
        ))}
        <button type="button" className="panel-puja__minimo" onClick={() => setElegido(0)} disabled={enviando || monto === minimo}>
          Mínimo
        </button>
      </div>
      {error && <p className="carrito__error" role="alert">{error}</p>}
      <button type="button" className="cplan__boton panel-puja__boton" onClick={pujar} disabled={enviando}>
        {enviando ? "Pujando…" : `Pujar ${formatBs(monto)}`}
      </button>
    </div>
  );
}
