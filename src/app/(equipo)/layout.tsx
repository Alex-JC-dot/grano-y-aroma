import type { Metadata } from "next";
import "../(publico)/publico.css";
import "../(publico)/paginas.css";
import "../(publico)/club-subastas.css";
import "../(publico)/carrito.css";
import "./equipo.css";
import MenuEquipo from "@/components/equipo/MenuEquipo";

export const metadata: Metadata = {
  title: "Equipo · Grano y Aroma",
  robots: { index: false },
};

/**
 * Layout de los paneles internos (Caja, Bodega y tueste, Logística, Panel general).
 * Mismos colores, tipografías y botones que la tienda (tokens de publico.css), pero con una
 * barra lateral y pantallas pensadas para trabajar, no para vender.
 */
export default function LayoutEquipo({ children }: { children: React.ReactNode }) {
  return (
    <div className="inicio equipo">
      <MenuEquipo />
      <main className="equipo__main" id="contenido">
        {children}
      </main>
    </div>
  );
}
