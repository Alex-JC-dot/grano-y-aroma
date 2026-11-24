import type { Metadata } from "next";
import "../(publico)/publico.css";
import "../(publico)/cuenta.css";

export const metadata: Metadata = {
  title: "Pago · Grano y Aroma",
  robots: { index: false },
};

/** Lo que abre el celular al escanear un QR de pago: sin menú ni sesión. */
export default function LayoutPagar({ children }: { children: React.ReactNode }) {
  return <main className="inicio pagar">{children}</main>;
}
