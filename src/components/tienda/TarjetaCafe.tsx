"use client";

import Link from "next/link";
import { useState } from "react";
import type { Product } from "@/lib/types";
import { formatBs } from "@/lib/utils";
import { categoriaDe, esCafe, rutaCafe } from "@/lib/catalogo";
import { useCartStore } from "@/store/cartStore";
import BolsaVisual from "./BolsaVisual";

/**
 * Tarjeta de un café: bolsa, nombre, origen, notas, puntaje, precio y "Agregar".
 * `revelar`: aparece al hacer scroll (Inicio). En el catálogo va en false, porque al cambiar
 * un filtro las tarjetas nuevas no pasan por el observador y quedarían ocultas.
 */
export default function TarjetaCafe({
  producto,
  indice = 0,
  revelar = true,
}: {
  producto: Product;
  indice?: number;
  revelar?: boolean;
}) {
  const agregar = useCartStore((s) => s.addItem);
  const [agregado, setAgregado] = useState(false);
  const cafe = esCafe(producto);

  const alAgregar = () => {
    agregar(producto, producto.grindTypes[0]);
    setAgregado(true);
    window.setTimeout(() => setAgregado(false), 1600);
  };

  return (
    <article
      className="card"
      data-revelar={revelar ? "" : undefined}
      style={{ "--i": indice } as React.CSSProperties}
    >
      <Link href={rutaCafe(producto)} className="card__link" aria-label={`Ver ${producto.name}`}>
        <BolsaVisual producto={producto} />
      </Link>
      <div className="card__body">
        <p className="card__origen">
          {cafe
            ? `${producto.region} · ${producto.altitude.toLocaleString("es-BO")} msnm${producto.categoria === "molido" ? " · Molido" : ""}`
            : producto.presentacion}
        </p>
        <h3 className="card__titulo">
          <Link href={rutaCafe(producto)}>{producto.name}</Link>
        </h3>
        <p className="card__notas">{cafe ? producto.flavorProfile.join(" · ") : producto.cuppingNotes}</p>
        <div className="card__pie">
          <div>
            <span className="card__precio">
              {formatBs(producto.price)}
              {cafe && categoriaDe(producto) === "grano" && <small className="card__peso"> · 250 g</small>}
            </span>
            {cafe && (
              <span className="card__puntaje">
                {producto.cuppingScore.toLocaleString("es-BO", { minimumFractionDigits: 1 })} puntos
              </span>
            )}
          </div>
          <button
            type="button"
            className={`btn btn--secondary btn--sm${agregado ? " is-added" : ""}`}
            onClick={alAgregar}
            disabled={producto.stock <= 0}
          >
            {producto.stock <= 0 ? "Agotado" : agregado ? "Agregado" : "Agregar"}
          </button>
        </div>
      </div>
    </article>
  );
}
