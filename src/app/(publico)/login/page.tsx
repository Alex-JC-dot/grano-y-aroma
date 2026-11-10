import type { Metadata } from "next";
import { Suspense } from "react";
import PaginaLogin from "@/components/cuenta/PaginaLogin";

export const metadata: Metadata = {
  title: "Iniciar sesión · Grano y Aroma",
  description: "Entra a tu cuenta de Grano y Aroma o crea una nueva.",
};

export default function Pagina() {
  return (
    <Suspense>
      <PaginaLogin />
    </Suspense>
  );
}
