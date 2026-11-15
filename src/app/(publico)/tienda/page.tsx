import type { Metadata } from "next";
import Catalogo from "@/components/tienda/Catalogo";
import FranjaOrigen from "@/components/tienda/FranjaOrigen";

export const metadata: Metadata = {
  title: "Tienda: cafés de origen tostados en Sucre · Grano y Aroma",
  description:
    "Cafés de especialidad de Chuquisaca y los Yungas, tostados por lote en Sucre. Filtra por origen, tueste y perfil de sabor.",
};

/**
 * Tienda: título, la franja horizontal "Cafés de origen" (se recorre al bajar) y debajo el
 * catálogo completo con pestañas y filtros.
 */
export default function PaginaTienda() {
  return (
    <>
      <section className="section page-top tienda-cabeza" aria-labelledby="tienda-titulo">
        <div className="wrap">
          <div className="head" data-revelar>
            <h1 id="tienda-titulo">Tienda de café</h1>
            <p>Cafés de origen boliviano tostados en Sucre, y todo lo que necesitas para prepararlos en casa.</p>
          </div>
        </div>
      </section>

      <FranjaOrigen />

      <section className="section tienda-catalogo" aria-labelledby="catalogo-titulo">
        <div className="wrap">
          <h2 id="catalogo-titulo" className="tienda-catalogo__titulo">
            Toda la tienda
          </h2>
          <Catalogo />
        </div>
      </section>
    </>
  );
}
