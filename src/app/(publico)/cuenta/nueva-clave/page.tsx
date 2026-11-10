import type { Metadata } from "next";
import NuevaClave from "@/components/cuenta/NuevaClave";

export const metadata: Metadata = {
  title: "Contraseña nueva · Grano y Aroma",
  robots: { index: false },
};

export default function Pagina() {
  return <NuevaClave />;
}
