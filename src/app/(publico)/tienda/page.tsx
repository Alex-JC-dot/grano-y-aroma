import type { Metadata } from "next";
import Catalogo from "@/components/tienda/Catalogo";

export const metadata: Metadata = {
  title: "Tienda: cafés de origen tostados en Sucre · Grano y Aroma",
  description:
    "Cafés de especialidad de Chuquisaca y los Yungas, tostados por lote en Sucre. Filtra por origen, tueste y perfil de sabor.",
};

export default function PaginaTienda() {
  return (
    <section className="section page-top" aria-labelledby="tienda-titulo">
      <div className="wrap">
        <div className="head" data-revelar>
          <h1 id="tienda-titulo">Tienda de café</h1>
          <p>Cafés de origen boliviano, tostados por lote en Sucre. Cada bolsa trae el código de su lote.</p>
        </div>
        <Catalogo />
      </div>
    </section>
  );
}
