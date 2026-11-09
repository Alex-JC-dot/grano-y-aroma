import "./inicio.css";
import CartDrawer from "@/components/home/CartDrawer";
import NavInicio from "@/components/inicio/NavInicio";
import HeroScroll from "@/components/inicio/HeroScroll";
import CafesOrigen from "@/components/inicio/CafesOrigen";
import { Proceso, Visita, PieInicio } from "@/components/inicio/SeccionesInicio";
import { products } from "@/lib/data";
import { formatBs } from "@/lib/utils";

export default function Inicio() {
  const precioDesde = formatBs(Math.min(...products.map((p) => p.price)));

  return (
    <div className="inicio" id="top">
      <NavInicio />
      <CartDrawer />
      <main id="contenido">
        <HeroScroll precioDesde={precioDesde} />
        <CafesOrigen />
        <Proceso />
        <Visita />
      </main>
      <PieInicio />
    </div>
  );
}
