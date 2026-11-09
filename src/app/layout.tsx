import type { Metadata } from "next";
import { Fraunces, Figtree } from "next/font/google";
import "./globals.css";

// Sistema visual: Fraunces (títulos) + Figtree (texto), servidas por next/font (sin pedir a Google en cada visita).
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });
const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree", display: "swap" });

export const metadata: Metadata = {
  title: "Grano y Aroma: café de especialidad tostado en Sucre",
  description:
    "Tostaduría y cafetería en Sucre, Bolivia. Cafés de origen con trazabilidad por lote, tienda en línea, club de suscripción y subastas de micro-lotes.",
  keywords: "café especialidad sucre bolivia, micro-lote, subasta café, grano y aroma",
  authors: [{ name: "Grano y Aroma" }],
  openGraph: {
    title: "Grano y Aroma: café de especialidad tostado en Sucre",
    description: "Café de especialidad boliviano con trazabilidad por lote.",
    locale: "es_BO",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${fraunces.variable} ${figtree.variable}`} suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
