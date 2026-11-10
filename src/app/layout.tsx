import type { Metadata } from "next";
import { Fraunces, Figtree } from "next/font/google";
import "./globals.css";

// Sistema visual: Fraunces (títulos) + Figtree (texto), servidas por next/font.
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

/**
 * Fija el tema ANTES del primer pintado.
 *
 * Sin esto, el navegador pinta en claro y React corrige medio segundo después: el usuario
 * que eligió oscuro ve un fogonazo blanco en cada carga. Es lo primero que nota la gente y
 * no hay forma de arreglarlo desde un componente, porque React corre después de pintar.
 *
 * Por eso va como script inline y síncrono en el <head>: se ejecuta antes de que el
 * navegador dibuje nada. Se escribe en texto plano porque Next no puede serializar una
 * función aquí.
 *
 * Orden de decisión: lo que el usuario eligió > lo que pide su sistema operativo > claro.
 * El try/catch es necesario porque localStorage lanza excepción en ventanas privadas con
 * las cookies bloqueadas, y sin él la página entera se quedaría en blanco.
 */
const FIJAR_TEMA = `(function(){try{var t=localStorage.getItem("ga-tema");if(t!=="dark"&&t!=="light"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t)}catch(e){document.documentElement.setAttribute("data-theme","light")}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${fraunces.variable} ${figtree.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: FIJAR_TEMA }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
