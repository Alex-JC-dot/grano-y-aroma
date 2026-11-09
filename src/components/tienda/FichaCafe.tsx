"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { products } from "@/lib/data";
import type { Product } from "@/lib/types";
import { formatBs } from "@/lib/utils";
import { buscarCafe, formatoFecha, imagenOrigen } from "@/lib/catalogo";
import { useCartStore } from "@/store/cartStore";
import BolsaVisual from "./BolsaVisual";
import TarjetaCafe from "./TarjetaCafe";

/** Ficha de producto con trazabilidad de origen (RF-05) y compra con molienda y cantidad. */
export default function FichaCafe() {
  const slug = useSearchParams().get("c");
  const cafe = buscarCafe(slug);

  if (!cafe) {
    return (
      <section className="section page-top">
        <div className="wrap">
          <h1 className="ficha__titulo">No encontramos ese café</h1>
          <p>Puede que ya no esté a la venta.</p>
          <Link href="/tienda" className="btn btn--primary">
            Ver todos los cafés
          </Link>
        </div>
      </section>
    );
  }

  // key: al pasar a otro café (misma página, otro ?c=) se reinician molienda y cantidad.
  return <Ficha key={cafe.id} cafe={cafe} />;
}

function Ficha({ cafe }: { cafe: Product }) {
  const agregar = useCartStore((s) => s.addItem);
  const abrirCarrito = useCartStore((s) => s.toggleCart);
  const [molienda, setMolienda] = useState(cafe.grindTypes[0]);
  const [cantidad, setCantidad] = useState(1);

  useEffect(() => {
    document.title = `${cafe.name}: café de ${cafe.region} · Grano y Aroma`;
  }, [cafe]);

  const alAgregar = () => {
    for (let i = 0; i < cantidad; i++) agregar(cafe, molienda || cafe.grindTypes[0]);
    abrirCarrito();
  };

  const otros = products.filter((p) => p.id !== cafe.id).slice(0, 3);
  const origen = imagenOrigen(cafe);
  const puntaje = cafe.cuppingScore.toLocaleString("es-BO", { minimumFractionDigits: 1 });

  return (
    <>
      <section className="section page-top" aria-labelledby="ficha-titulo">
        <div className="wrap">
          <nav className="migas" aria-label="Estás en">
            <Link href="/tienda" className="link">
              Tienda
            </Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{cafe.name}</span>
          </nav>

          <div className="ficha">
            <div className="ficha__visual">
              <BolsaVisual producto={cafe} grande />
            </div>

            <div className="ficha__info">
              <p className="ficha__origen">
                {cafe.region}, {cafe.origin} · {cafe.altitude.toLocaleString("es-BO")} msnm
              </p>
              <h1 id="ficha-titulo" className="ficha__titulo">
                {cafe.name}
              </h1>
              <p className="ficha__notas">{cafe.cuppingNotes}</p>

              <div className="ficha__compra">
                <p className="ficha__precio">{formatBs(cafe.price)}</p>

                <label className="campo">
                  <span>Molienda</span>
                  <select value={molienda} onChange={(e) => setMolienda(e.target.value)}>
                    {cafe.grindTypes.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </label>

                <div className="campo">
                  <span id="cantidad-label">Cantidad</span>
                  <div className="cantidad" role="group" aria-labelledby="cantidad-label">
                    <button type="button" aria-label="Quitar una" onClick={() => setCantidad((c) => Math.max(1, c - 1))}>
                      −
                    </button>
                    <output aria-live="polite">{cantidad}</output>
                    <button type="button" aria-label="Agregar una" onClick={() => setCantidad((c) => Math.min(10, c + 1))}>
                      +
                    </button>
                  </div>
                </div>

                <button type="button" className="btn btn--primary ficha__agregar" onClick={alAgregar}>
                  Agregar al carrito · {formatBs(cafe.price * cantidad)}
                </button>
              </div>

              <h2 className="ficha__subtitulo">Trazabilidad del lote</h2>
              <dl className="ficha__datos">
                <dt>Código de lote</dt>
                <dd>{cafe.lotCode}</dd>
                <dt>Finca / región</dt>
                <dd>
                  {cafe.region}, {cafe.origin}
                </dd>
                <dt>Altura</dt>
                <dd>{cafe.altitude.toLocaleString("es-BO")} msnm</dd>
                <dt>Fecha de tueste</dt>
                <dd>{formatoFecha(cafe.roastDate)}</dd>
                <dt>Tueste</dt>
                <dd>{cafe.roastLevel}</dd>
                <dt>Perfil de sabor</dt>
                <dd>{cafe.flavorProfile.join(", ")}</dd>
                <dt>Puntaje de catación</dt>
                <dd>{puntaje} puntos</dd>
              </dl>
            </div>
          </div>
        </div>
      </section>

      <section className="section section--tight" aria-labelledby="origen-titulo">
        <div className="wrap">
          <div className="head">
            <h2 id="origen-titulo">De dónde viene este café</h2>
            <div>
              <p>
                {cafe.region}, {cafe.origin} · {cafe.altitude.toLocaleString("es-BO")} msnm. Compramos el
                grano verde por lote y lo tostamos en Sucre.
              </p>
            </div>
          </div>
          <figure className="banda-foto">
            {/* eslint-disable-next-line @next/next/no-img-element -- export estático */}
            <img src={origen.src} alt={origen.alt} loading="lazy" decoding="async" />
          </figure>
        </div>
      </section>

      <section className="section section--tight" aria-labelledby="otros-titulo">
        <div className="wrap">
          <div className="head">
            <h2 id="otros-titulo">Otros cafés</h2>
            <div>
              <Link href="/tienda" className="link head__link">
                Ver la tienda →
              </Link>
            </div>
          </div>
          <div className="cards cards--3">
            {otros.map((p, i) => (
              <TarjetaCafe key={p.id} producto={p} indice={i} revelar={false} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
