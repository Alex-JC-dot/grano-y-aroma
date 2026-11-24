"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { formatBs } from "@/lib/utils";
import { descripcionDe, opcionesDe, porDefecto, SECCIONES, seccionDe, sinMovimiento, textoOpciones, type ItemTotem } from "@/lib/totem";
import FotoTotem from "./FotoTotem";

/**
 * El producto que se expande: la tarjeta tocada crece hasta llenar la pantalla y su foto viaja
 * desde donde estaba hasta arriba, en grande (técnica FLIP: se mide dónde empieza y dónde
 * termina, y se anima la diferencia). Al cerrar hace el camino inverso.
 */
const SUAVE = "cubic-bezier(0.22, 0.8, 0.2, 1)";

export default function DetalleTotem({
  item,
  tarjeta,
  foto,
  disponibles,
  alAgregar,
  alCerrar,
}: {
  item: ItemTotem;
  /** Dónde estaban la tarjeta y su foto al tocarla. */
  tarjeta: DOMRect;
  foto: DOMRect;
  /** Cuántos quedan sin contar los que ya están en el pedido. */
  disponibles: number;
  alAgregar: (qty: number, opciones: string, desde: Element | null) => void;
  alCerrar: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const imagen = useRef<HTMLSpanElement>(null);
  const [elegidas, setElegidas] = useState(() => porDefecto(item));
  const [qty, setQty] = useState(1);
  const cerrando = useRef(false);
  const grupos = opcionesDe(item);

  const recorte = () =>
    `inset(${Math.max(0, Math.min(tarjeta.top, foto.top))}px ${Math.max(0, window.innerWidth - tarjeta.right)}px ${Math.max(0, window.innerHeight - tarjeta.bottom)}px ${Math.max(0, tarjeta.left)}px round 28px)`;

  const animar = (abrir: boolean) => {
    const p = panel.current, i = imagen.current;
    if (!p || !i || sinMovimiento()) return null;
    const fin = i.getBoundingClientRect();
    const dx = foto.left + foto.width / 2 - (fin.left + fin.width / 2);
    const dy = foto.top + foto.height / 2 - (fin.top + fin.height / 2);
    const chico = `translate(${dx}px, ${dy}px) scale(${foto.width / fin.width})`;
    const opciones: KeyframeAnimationOptions = { duration: abrir ? 520 : 380, easing: SUAVE, fill: "both" };
    const panelCuadros = [{ clipPath: recorte() }, { clipPath: "inset(0px 0px 0px 0px round 0px)" }];
    const fotoCuadros = [{ transform: chico }, { transform: "none" }];
    p.animate(abrir ? panelCuadros : panelCuadros.reverse(), opciones);
    return i.animate(abrir ? fotoCuadros : fotoCuadros.reverse(), opciones);
  };

  // Antes del primer pintado, para que no se vea un parpadeo del panel ya abierto.
  useLayoutEffect(() => {
    animar(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir
  }, []);

  const cerrar = () => {
    if (cerrando.current) return;
    cerrando.current = true;
    panel.current?.classList.add("is-cerrando");
    const a = animar(false);
    if (!a) return alCerrar();
    a.finished.then(alCerrar, alCerrar);
  };

  const agregar = () => {
    alAgregar(qty, textoOpciones(item, elegidas), imagen.current);
    cerrar();
  };

  return (
    <div ref={panel} className="tdetalle" role="dialog" aria-modal="true" aria-label={item.nombre}>
      <div className="tdetalle__arriba">
        <button type="button" className="tvolver" onClick={cerrar}>
          <Flecha /> Volver
        </button>
        <FotoTotem item={item} ref={imagen} />
      </div>

      <div className="tdetalle__cuerpo">
        <p className="tdetalle__seccion">{SECCIONES.find((x) => x.id === seccionDe(item))?.nombre}</p>
        <h2>{item.nombre}</h2>
        <p className="tdetalle__texto">{descripcionDe(item)}</p>

        {grupos.map((g, k) => (
          <fieldset key={g.titulo} className="tdetalle__grupo">
            <legend>{g.titulo}</legend>
            {g.valores.map((v) => (
              <button
                key={v}
                type="button"
                className={elegidas[k] === v ? "is-on" : ""}
                aria-pressed={elegidas[k] === v}
                onClick={() => setElegidas((e) => e.map((x, j) => (j === k ? v : x)))}
              >
                {v}
              </button>
            ))}
          </fieldset>
        ))}
      </div>

      <div className="tdetalle__pie">
        <span className="tcantidad">
          <button type="button" aria-label="Uno menos" disabled={qty <= 1} onClick={() => setQty((q) => q - 1)}>−</button>
          <output>{qty}</output>
          <button type="button" aria-label="Uno más" disabled={qty >= disponibles} onClick={() => setQty((q) => q + 1)}>+</button>
        </span>
        <button type="button" className="tprincipal" disabled={disponibles < 1} onClick={agregar}>
          {disponibles < 1 ? "No queda más" : <>Agregar <strong>{formatBs(item.precio * qty)}</strong></>}
        </button>
      </div>
    </div>
  );
}

export function Flecha() {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}
