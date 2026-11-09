import type { Metadata } from "next";
import Link from "next/link";
import { AsiTrabajamos, Visita } from "@/components/inicio/SeccionesInicio";
import MapaOrigenes from "@/components/inicio/MapaOrigenes";
import Cifras from "@/components/nosotros/Cifras";
import CurvaTueste from "@/components/nosotros/CurvaTueste";

export const metadata: Metadata = {
  title: "Nosotros: tostaduría y cafetería en Sucre · Grano y Aroma",
  description:
    "Compramos café verde por lote a productores bolivianos, lo tostamos en Sucre y registramos cada lote para que sepas de dónde viene tu café.",
};

export default function PaginaNosotros() {
  return (
    <>
      <section className="section page-top" aria-labelledby="nosotros-titulo">
        <div className="wrap intro">
          <h1 id="nosotros-titulo" data-revelar>
            Tostamos en Sucre el café de los productores bolivianos
          </h1>
          <div className="intro__texto" data-revelar style={{ "--i": 1 } as React.CSSProperties}>
            <p>
              Somos una tostaduría y cafetería en el centro histórico de Sucre. Compramos café verde por
              lote a productores de los Yungas, Caranavi y los valles de Chuquisaca, como Villa Serrano y
              Padilla.
            </p>
            <p>
              Cada lote se registra desde que llega: su origen, su curva de tueste y sus notas de catación.
              Por eso cada bolsa lleva un código con el que puedes saber de qué finca y de qué tueste viene
              tu café.
            </p>
            <Link href="/tienda" className="btn btn--primary">
              Ver los cafés
            </Link>
          </div>
        </div>
        <div className="wrap">
          <figure className="banda-foto banda-foto--alta" data-revelar>
            {/* eslint-disable-next-line @next/next/no-img-element -- export estático */}
            <img
              src="/images/origen/sucre.webp"
              alt="Techos de tejas y fachadas blancas de una ciudad colonial con un campanario, frente a los cerros al atardecer"
              decoding="async"
            />
          </figure>
        </div>
      </section>
      <Cifras />
      <MapaOrigenes conRegiones />
      <AsiTrabajamos />
      <CurvaTueste />
      <Visita />
    </>
  );
}
