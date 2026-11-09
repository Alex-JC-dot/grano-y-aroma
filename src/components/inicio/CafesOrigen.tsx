"use client";

import { useState } from "react";
import { products } from "@/lib/data";
import { formatBs } from "@/lib/utils";
import { useCartStore } from "@/store/cartStore";

/**
 * Lista de cafés como la carta de un tostador: nombre, origen, notas, puntaje y precio.
 * Sin fotos por ahora: el proyecto no tiene fotos reales de las bolsas (pendiente de generar).
 */
export default function CafesOrigen() {
  const agregar = useCartStore((s) => s.addItem);
  const [agregado, setAgregado] = useState<string | null>(null);

  const alAgregar = (id: string) => {
    const producto = products.find((p) => p.id === id);
    if (!producto) return;
    agregar(producto, producto.grindTypes[0]);
    setAgregado(id);
    window.setTimeout(() => setAgregado((a) => (a === id ? null : a)), 1600);
  };

  return (
    <section className="section" id="cafes" aria-labelledby="cafes-titulo">
      <div className="wrap">
        <div className="head" data-revelar>
          <h2 id="cafes-titulo">Cafés de origen, tostados en Sucre</h2>
          <p>Cada bolsa indica su finca, su altura y el código del lote con el que se tostó.</p>
        </div>

        <ul className="rows">
          {products.map((p, i) => (
            <li key={p.id} className="row" data-revelar style={{ "--i": i } as React.CSSProperties}>
              <div className="row__name">
                <h3>{p.name}</h3>
                <p>
                  {p.region}, {p.origin} · {p.altitude.toLocaleString("es-BO")} msnm · Tueste {p.roastLevel.toLowerCase()}
                </p>
              </div>
              <p className="row__notes">{p.cuppingNotes}</p>
              <div className="row__score">
                <strong>{p.cuppingScore.toLocaleString("es-BO", { minimumFractionDigits: 1 })}</strong>
                puntos
              </div>
              <div className="row__price">{formatBs(p.price)}</div>
              <div className="row__add">
                <button
                  type="button"
                  className={`btn btn--secondary${agregado === p.id ? " is-added" : ""}`}
                  onClick={() => alAgregar(p.id)}
                >
                  {agregado === p.id ? "Agregado" : "Agregar al carrito"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
