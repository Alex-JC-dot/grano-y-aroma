import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Grano y Aroma — Café de Especialidad · Sucre, Bolivia",
  description:
    "Plataforma integral de café de especialidad en Sucre, Bolivia. E-commerce, subastas de micro-lotes, club de suscripciones y trazabilidad completa de origen.",
  keywords: "café especialidad sucre bolivia, micro-lote, subasta café, grano y aroma",
  authors: [{ name: "Grano y Aroma" }],
  openGraph: {
    title: "Grano y Aroma — Café de Especialidad · Sucre, Bolivia",
    description: "Café de especialidad boliviano con trazabilidad completa.",
    locale: "es_BO",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Inter:wght@300;400;500;600;700&family=Lora:ital,wght@0,400;0,600;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
