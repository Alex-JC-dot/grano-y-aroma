import type { Metadata } from "next";
import { Suspense } from "react";
import FichaCafe from "@/components/tienda/FichaCafe";

export const metadata: Metadata = {
  title: "Café de origen · Grano y Aroma",
  description: "Origen, altura, notas de catación y lote de tueste de cada café de Grano y Aroma.",
};

/**
 * Ficha de un café: /tienda/cafe?c=<slug>.
 * Es una sola página que lee el café de la dirección, para que funcione con el export
 * estático hoy y con los productos de Supabase después (un café nuevo no necesita
 * volver a publicar el sitio).
 */
export default function PaginaCafe() {
  return (
    <Suspense fallback={<div className="section page-top" aria-busy="true" />}>
      <FichaCafe />
    </Suspense>
  );
}
