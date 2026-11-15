"use client";
/* eslint-disable @next/next/no-img-element -- export estático: next/image no optimiza aquí */

import { useEffect, useRef } from "react";
import { alScroll, conMovimiento, limitar } from "@/lib/scrollAnimado";

const TRABAJO = [
  { img: "/images/nosotros/recepcion.webp", alt: "Sacos de yute con café verde y una etiqueta de lote", titulo: "Recibimos el lote", texto: "Cada saco llega con su etiqueta: finca, variedad y fecha. Lo pesamos y lo guardamos en bodega." },
  { img: "/images/nosotros/tostadora.webp", alt: "Granos recién tostados cayendo a la bandeja de enfriado de la tostadora", titulo: "Lo tostamos", texto: "Tostamos en tandas pequeñas y registramos la curva de cada tueste." },
  { img: "/images/nosotros/catacion.webp", alt: "Mesa de catación con tazas, cucharas y muestras de grano", titulo: "Lo catamos", texto: "Cada lote pasa por la mesa de catación y recibe su puntaje antes de salir a la venta." },
  { img: "/images/nosotros/embolsado.webp", alt: "Bolsas kraft de café sobre una mesa de trabajo junto a una balanza", titulo: "Lo embolsamos", texto: "Pesamos cada bolsa y le ponemos el código del lote para que puedas rastrearla." },
];

/**
 * Nosotros: "Así trabajamos cada lote" como un recorrido en capas. Cada paso es una hoja que
 * ocupa la pantalla y se queda fija; la siguiente sube por encima y la anterior se aleja un
 * poco (se achica y se oscurece). La foto se mueve más lento que la hoja (parallax) y el texto
 * entra flotando.
 *
 * Variables que se escriben en cada hoja:
 *  --entra  0 → 1 mientras la hoja sube desde abajo hasta quedar arriba.
 *  --sale   0 → 1 mientras la hoja siguiente la tapa.
 *
 * Con "reducir movimiento" no se escribe nada: las hojas igual se apilan (es solo sticky),
 * pero sin parallax ni escalas.
 */
export default function Recorrido() {
  const lista = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const ol = lista.current;
    if (!ol || !conMovimiento()) return;
    const hojas = [...ol.querySelectorAll<HTMLElement>(".capa")];

    return alScroll(() => {
      const alto = window.innerHeight;
      const entra = hojas.map((h) => limitar(1 - h.getBoundingClientRect().top / alto));
      hojas.forEach((h, i) => {
        h.style.setProperty("--entra", entra[i].toFixed(4));
        h.style.setProperty("--sale", (entra[i + 1] ?? 0).toFixed(4));
      });
    });
  }, []);

  return (
    <section className="section recorrido" id="trabajo" aria-labelledby="trabajo-titulo">
      <div className="wrap">
        <div className="head" data-revelar>
          <h2 id="trabajo-titulo">Así trabajamos cada lote</h2>
          <div>
            <p>Cada lote pasa por cuatro pasos y queda registrado en cada uno.</p>
          </div>
        </div>
      </div>

      <ol ref={lista} className="recorrido__capas">
        {TRABAJO.map((p, i) => (
          <li key={p.titulo} className="capa" style={{ zIndex: i + 1 }}>
            <div className="capa__hoja">
              <div className="capa__texto">
                <span className="capa__num" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3>{p.titulo}</h3>
                <p>{p.texto}</p>
                <span className="capa__paso">
                  Paso {i + 1} de {TRABAJO.length}
                </span>
              </div>
              <figure className="capa__foto">
                <img src={p.img} alt={p.alt} loading="lazy" decoding="async" />
              </figure>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
