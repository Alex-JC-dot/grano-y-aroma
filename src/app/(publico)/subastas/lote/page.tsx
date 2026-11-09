import type { Metadata } from "next";
import { Suspense } from "react";
import FichaLote from "@/components/subastas/FichaLote";

export const metadata: Metadata = {
  title: "Lote en subasta · Grano y Aroma",
  description: "Puja en vivo, rueda de catación e historial de pujas de un micro-lote de café.",
};

/** Ficha de un lote: /subastas/lote?l=<id> (una sola página para el export estático). */
export default function PaginaLote() {
  return (
    <Suspense fallback={<div className="section page-top" aria-busy="true" />}>
      <FichaLote />
    </Suspense>
  );
}
