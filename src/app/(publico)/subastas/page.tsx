import type { Metadata } from "next";
import Subastas from "@/components/subastas/Subastas";

export const metadata: Metadata = {
  title: "Subastas de micro-lotes de café · Grano y Aroma",
  description:
    "Puja en vivo por micro-lotes de café de especialidad de Chuquisaca. Cierre automático y adjudicación a la puja más alta.",
};

export default function PaginaSubastas() {
  return <Subastas />;
}
