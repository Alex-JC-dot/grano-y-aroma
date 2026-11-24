import type { Metadata, Viewport } from "next";
import "../(publico)/publico.css";
import "../(publico)/carrito.css";
import "../(publico)/cuenta.css";
import "./totem.css";
import Sesion from "@/components/cuenta/Sesion";

export const metadata: Metadata = {
  title: "Tótem · Grano y Aroma",
  robots: { index: false },
};

// Pantalla táctil: sin zoom accidental al tocar dos veces ni al pellizcar.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

/**
 * Layout del tótem de autoservicio (EXPOSOFT): sin la barra de la tienda ni el menú del
 * equipo, porque en un tótem el cliente solo debe poder pedir y pagar. Es la misma web y la
 * misma base de datos que el resto; solo cambia la puerta de entrada.
 */
export default function LayoutTotem({ children }: { children: React.ReactNode }) {
  return (
    <div className="inicio totem-app">
      {children}
      <Sesion />
    </div>
  );
}
