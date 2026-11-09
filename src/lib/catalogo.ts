import { products } from "./data";
import type { Product } from "./types";

/**
 * Utilidades del catálogo público. Hoy leen los datos de prueba de data.ts; cuando la tienda
 * pase a Supabase, solo cambia de dónde salen los productos, no las páginas que los usan.
 */

/** Dirección legible del café: "Villa Serrano Natural" → "villa-serrano-natural". */
export function slugDe(p: Pick<Product, "name">): string {
  return p.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function rutaCafe(p: Pick<Product, "name">): string {
  return `/tienda/cafe?c=${slugDe(p)}`;
}

export function buscarCafe(slug: string | null): Product | undefined {
  if (!slug) return undefined;
  return products.find((p) => slugDe(p) === slug);
}

/**
 * Color de la etiqueta de cada bolsa (el mismo que se usará al generar sus fotos).
 * Mientras no haya fotos, la tarjeta muestra la bolsa como un panel de este color.
 */
const COLORES: Record<string, string> = {
  p1: "#b5603f", // terracota
  p2: "#5f6b3a", // verde oliva
  p3: "#c4952f", // mostaza
  p4: "#3a3532", // carbón
  p5: "#7a2e35", // burdeos
  p6: "#5d7b95", // azul grisáceo
};

export function colorDe(p: Pick<Product, "id">): string {
  return COLORES[p.id] ?? "#7a4a2c";
}

/** Opciones de los filtros de la tienda, sacadas de los propios productos. */
export function opcionesDeFiltro(lista: Product[] = products) {
  const unicos = (xs: string[]) => [...new Set(xs)].sort((a, b) => a.localeCompare(b, "es"));
  return {
    origenes: unicos(lista.map((p) => p.origin)),
    tuestes: ["Ligero", "Medio", "Oscuro"].filter((t) => lista.some((p) => p.roastLevel === t)),
    perfiles: unicos(lista.flatMap((p) => p.flavorProfile)),
  };
}

export function formatoFecha(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-BO", { day: "numeric", month: "long", year: "numeric" });
}
