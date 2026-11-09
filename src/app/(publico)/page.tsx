import HeroScroll from "@/components/inicio/HeroScroll";
import { Destacados, ClubYSubastas } from "@/components/inicio/AdelantosInicio";
import { Proceso } from "@/components/inicio/SeccionesInicio";
import MapaOrigenes from "@/components/inicio/MapaOrigenes";
import { cafes } from "@/lib/catalogo";
import { formatBs } from "@/lib/utils";

/** Inicio: el hero con la animación del grano y un adelanto de cada sección del sitio. */
export default function Inicio() {
  const precioDesde = formatBs(Math.min(...cafes.map((p) => p.price)));

  return (
    <>
      <HeroScroll precioDesde={precioDesde} />
      <Destacados />
      <MapaOrigenes />
      <Proceso conEnlace />
      <ClubYSubastas />
    </>
  );
}
