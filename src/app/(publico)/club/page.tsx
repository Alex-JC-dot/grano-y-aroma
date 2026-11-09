import type { Metadata } from "next";
import Club from "@/components/club/Club";

export const metadata: Metadata = {
  title: "Club Grano y Aroma: café recién tostado cada 15 o 30 días",
  description:
    "Suscripción de café de especialidad en Sucre: elige frecuencia, cantidad y molienda, y pausa cuando quieras. Desde Bs. 89 por entrega.",
};

export default function PaginaClub() {
  return <Club />;
}
