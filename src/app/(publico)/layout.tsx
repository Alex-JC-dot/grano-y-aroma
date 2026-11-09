import "./publico.css";
import "./paginas.css";
import "./club-subastas.css";
import "./mapa.css";
import CartDrawer from "@/components/home/CartDrawer";
import NavInicio from "@/components/inicio/NavInicio";
import { PieInicio } from "@/components/inicio/SeccionesInicio";
import RevelarAlScroll from "@/components/inicio/RevelarAlScroll";

/**
 * Layout de las páginas públicas (Inicio, Tienda, Nosotros…): la misma barra, el carrito,
 * el pie con la taza y la aparición de bloques al hacer scroll. Los paneles internos
 * (POS, bodega, admin) quedan fuera de este grupo con su propio diseño.
 */
export default function LayoutPublico({ children }: { children: React.ReactNode }) {
  return (
    <div className="inicio" id="top">
      <NavInicio />
      <CartDrawer />
      <main id="contenido">{children}</main>
      <PieInicio />
      <RevelarAlScroll />
    </div>
  );
}
