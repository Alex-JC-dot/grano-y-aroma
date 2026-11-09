"use client";

/* eslint-disable @next/next/no-img-element -- export estático: next/image no optimiza aquí */
import Link from "next/link";
import { esCafe } from "@/lib/catalogo";
import { useProductos } from "@/store/catalogoStore";
import TarjetaCafe from "@/components/tienda/TarjetaCafe";

/** Inicio: tres cafés destacados con enlace a la tienda completa. */
export function Destacados() {
  // Los tres de mayor puntaje de catación.
  const cafes = useProductos().filter(esCafe);
  const destacados = [...cafes].sort((a, b) => b.cuppingScore - a.cuppingScore).slice(0, 3);

  return (
    <section className="section" id="cafes" aria-labelledby="cafes-titulo">
      <div className="wrap">
        <div className="head" data-revelar>
          <h2 id="cafes-titulo">Cafés de origen, tostados en Sucre</h2>
          <div>
            <p>Cada bolsa indica su finca, su altura y el código del lote con el que se tostó.</p>
            <Link href="/tienda" className="link head__link">
              Ver toda la tienda →
            </Link>
          </div>
        </div>
        <div className="cards cards--3">
          {destacados.map((p, i) => (
            <TarjetaCafe key={p.id} producto={p} indice={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

/** Inicio: adelantos del Club y de las Subastas, cada uno con su página. */
export function ClubYSubastas() {
  return (
    <section className="section" aria-label="Club y subastas">
      <div className="wrap duo">
        <Link href="/club" className="duo__item" data-revelar>
          <div className="duo__visual">
            <img
              src="/video/club-caja-final.webp"
              alt="Caja de suscripción abierta con dos bolsas de café y granos tostados"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="duo__texto">
            <p className="duo__etiqueta">Club Grano y Aroma</p>
            <h2>Café fresco en tu puerta cada 15 o 30 días</h2>
            <p>Elige la frecuencia y la molienda, y pausa cuando quieras. Desde Bs. 89 por entrega.</p>
            <span className="link duo__mas">Conocer el Club →</span>
          </div>
        </Link>
        <Link href="/subastas" className="duo__item" data-revelar style={{ "--i": 1 } as React.CSSProperties}>
          <div className="duo__visual">
            <img
              src="/images/home/microlote.webp"
              alt="Granos de café verde derramados de un saco de yute"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="duo__texto">
            <p className="duo__etiqueta">Subastas de micro-lotes</p>
            <h2>Lotes únicos de Chuquisaca, al mejor postor</h2>
            <p>Puja en vivo por cafés de producción limitada con puntaje de catación de 87 o más.</p>
            <span className="link duo__mas">Ver las subastas →</span>
          </div>
        </Link>
      </div>
    </section>
  );
}
