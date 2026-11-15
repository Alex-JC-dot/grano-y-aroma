"use client";
/* eslint-disable @next/next/no-img-element -- export estático: next/image no optimiza aquí */

import { useEffect, useRef } from "react";
import { alScroll, avanceDe, reducirMovimiento } from "@/lib/scrollAnimado";

/**
 * Nosotros: el paisaje de los Yungas armado en capas que se mueven a distinta velocidad al
 * hacer scroll (parallax), como la portada del modelo:
 *
 *  - fondo: montañas al atardecer, casi quietas;
 *  - niebla: dos bandas que cruzan despacio (hechas con CSS, no son imágenes);
 *  - medio: la ladera con el cafetal, que sube desde abajo;
 *  - frente: ramas con cerezas a los costados, que se abren y pasan rápido.
 *
 * El componente solo escribe --p (0 a 1) en la sección; cada capa calcula su movimiento en CSS.
 * Las capas medio y frente se recortaron del fondo blanco original de Kling.
 * Con "reducir movimiento" la escena queda quieta en su punto medio.
 */
export default function PaisajeYungas() {
  const seccionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const s = seccionRef.current;
    if (!s) return;
    if (reducirMovimiento()) {
      s.style.setProperty("--p", "0.5");
      return;
    }
    return alScroll(() => s.style.setProperty("--p", avanceDe(s).toFixed(4)));
  }, []);

  return (
    <section ref={seccionRef} className="yungas" aria-labelledby="yungas-titulo">
      <div className="yungas__escena">
        <img className="yungas__capa yungas__fondo" src="/images/yungas/fondo.webp" alt="" decoding="async" />
        <div className="yungas__niebla yungas__niebla--lejos" aria-hidden="true" />
        <div className="yungas__texto">
          <p className="yungas__eyebrow">De dónde viene tu café</p>
          <h2 id="yungas-titulo">Nuestros cafés nacen en los Yungas</h2>
          <p>
            Laderas entre 1.400 y 1.900 metros, niebla todas las mañanas y cafetales a la sombra de los árboles.
            De ahí y de los valles de Chuquisaca sale cada lote que tostamos.
          </p>
        </div>
        <img
          className="yungas__capa yungas__medio"
          src="/images/yungas/medio.webp"
          alt="Hileras de cafetos en una ladera de los Yungas al atardecer, con montañas y niebla al fondo"
          decoding="async"
        />
        <div className="yungas__niebla yungas__niebla--cerca" aria-hidden="true" />
        <img className="yungas__capa yungas__rama yungas__rama--izq" src="/images/yungas/frente.webp" alt="" decoding="async" />
        <img className="yungas__capa yungas__rama yungas__rama--der" src="/images/yungas/frente.webp" alt="" decoding="async" />
      </div>
    </section>
  );
}
