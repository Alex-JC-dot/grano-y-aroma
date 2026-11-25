import type { Metadata } from "next";
import Link from "next/link";
import { AsiTrabajamos } from "@/components/inicio/SeccionesInicio";
import Galeria from "@/components/nosotros/Galeria";
import MapaOrigenes from "@/components/inicio/MapaOrigenes";
import Cifras from "@/components/nosotros/Cifras";
import MapaVisita from "@/components/nosotros/MapaVisita";
import CurvaTueste from "@/components/nosotros/CurvaTueste";

export const metadata: Metadata = {
  title: "Nosotros: tostaduría y cafetería en Sucre · Grano y Aroma",
  description:
    "Compramos café verde por lote a productores bolivianos, lo tostamos en Sucre y registramos cada lote para que sepas de dónde viene tu café.",
};

export default function PaginaNosotros() {
  return (
    <div className="nosotros">
      <section className="portada-nos" aria-labelledby="nosotros-titulo">
        {/* eslint-disable-next-line @next/next/no-img-element -- export estático */}
        <img
          className="portada-nos__foto"
          src="/images/origen/sucre.webp"
          alt="Techos de tejas y fachadas blancas de Sucre con un campanario, frente a los cerros al atardecer"
          fetchPriority="high"
        />
        <div className="wrap">
          <div className="portada-nos__texto">
            <p className="eyebrow">Nosotros</p>
            <h1 id="nosotros-titulo">Tostamos en Sucre el café de los productores bolivianos</h1>
            <Link href="/tienda" className="btn btn--primary">
              Ver los cafés
            </Link>
          </div>
        </div>
      </section>
      <Cifras />
      <section className="nos-historia" aria-label="Quiénes somos">
        <div className="wrap nos-historia__textos" data-revelar>
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
        </div>
      </section>
      <MapaOrigenes conRegiones />
      <AsiTrabajamos />
      <CurvaTueste />
      <Galeria />
      <MapaVisita />
    </div>
  );
}
