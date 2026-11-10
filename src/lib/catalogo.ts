import { products } from "./data";
import type { Product } from "./types";

/**
 * Utilidades del catálogo público. La tienda lee los productos de Supabase (useProductos);
 * "products"/"cafes" son la copia fija para las secciones informativas (inicio, nosotros).
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

export function buscarCafe(slug: string | null, lista: Product[] = products): Product | undefined {
  if (!slug) return undefined;
  return lista.find((p) => slugDe(p) === slug);
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

/**
 * Paisaje del origen de un café (fotos generadas con Kling): los Yungas para Caranavi y
 * Coroico, y los valles de Chuquisaca para Villa Serrano y Padilla.
 */
export function imagenOrigen(p: Pick<Product, "region" | "origin">): { src: string; alt: string } {
  const r = p.region.toLowerCase();
  if (r.includes("coroico"))
    return { src: "/images/origen/coroico.webp", alt: "Cerros verdes de los Yungas con neblina en el valle, al amanecer" };
  if (p.origin === "La Paz")
    return { src: "/images/origen/caranavi.webp", alt: "Valle de los Yungas con neblina y una ladera con plantas de café" };
  return { src: "/images/origen/chuquisaca.webp", alt: "Valles de Chuquisaca con una rama de cafeto con cerezas rojas" };
}

export function colorDe(p: Pick<Product, "id" | "color">): string {
  return p.color ?? COLORES[p.id] ?? "#7a4a2c";
}

/** Opciones de los filtros de la tienda, sacadas de los propios productos. */
export function opcionesDeFiltro(todos: Product[] = products) {
  const lista = todos.filter(esCafe);
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

/** Café en grano o molido (tienen origen, tueste, lote y puntaje). */
export function esCafe(p: Pick<Product, "categoria" | "origin">): boolean {
  return (!p.categoria || p.categoria === "grano" || p.categoria === "molido") && !!p.origin;
}

export const cafes = products.filter(esCafe);

export const CATEGORIAS: { id: "todos" | NonNullable<Product["categoria"]>; label: string }[] = [
  { id: "todos", label: "Todo" },
  { id: "grano", label: "Café en grano" },
  { id: "molido", label: "Café molido" },
  { id: "jarabe", label: "Jarabes" },
  { id: "equipo", label: "Equipos" },
  { id: "accesorio", label: "Accesorios" },
];

export function categoriaDe(p: Pick<Product, "categoria">) {
  return p.categoria ?? "grano";
}
