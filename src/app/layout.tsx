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

/**
 * Decide si sale la animación de entrada (components/inicio/Intro.tsx), también antes del primer
 * pintado: solo en el Inicio, una vez por visita (pestaña) y si no se pidió reducir movimiento.
 * Con /?intro se fuerza, para mostrarla. Pase lo que pase, a los 7 segundos se quita sola.
 */
const DECIDIR_INTRO = `(function(){try{var d=document.documentElement,f=/[?&]intro\\b/.test(location.search);if(location.pathname!=="/")return;if(!f&&(sessionStorage.getItem("ga-intro")||window.matchMedia("(prefers-reduced-motion: reduce)").matches))return;sessionStorage.setItem("ga-intro","1");d.setAttribute("data-intro","si");setTimeout(function(){if(d.getAttribute("data-intro")==="si")d.setAttribute("data-intro","fin")},7000)}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${fraunces.variable} ${figtree.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: FIJAR_TEMA }} />
        <script dangerouslySetInnerHTML={{ __html: DECIDIR_INTRO }} />
      </head>
      {/*
        suppressHydrationWarning también en <body>, no solo en <html>: el atributo solo vale
        para el elemento que lo lleva, no se hereda.

        Muchas extensiones del navegador (gestores de contraseñas, correctores, bloqueadores)
        escriben atributos propios en <body> antes de que React hidrate, y React avisa de que
        el HTML del servidor no coincide con el del navegador. El aviso es real pero ajeno al
        proyecto: no hay forma de evitar que una extensión toque la página, y el usuario final
        tendrá las suyas. Silenciarlo aquí es lo que recomienda la documentación de React.
      */}
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
