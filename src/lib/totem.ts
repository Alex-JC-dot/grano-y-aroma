/**
 * Datos del menú del tótem: secciones, fotos, descripciones y opciones de cada producto.
 *
 * Los productos, precios y stock salen de Supabase. Lo que está aquí es solo presentación: la
 * foto recortada y una descripción corta por si el producto todavía no tiene la suya. Si el
 * admin carga una foto o una descripción en Productos, esas mandan.
 */

export type ItemTotem = {
  id: string;
  nombre: string;
  categoria: string;
  precio: number;
  stock: number;
  grupo: string | null;
  color: string | null;
  descripcion: string;
  presentacion: string | null;
  moliendas: string[] | null;
  foto: { src: string } | null;
};

/** Una línea del pedido. El mismo café con otra leche es otra línea. */
export type LineaTotem = { clave: string; item: ItemTotem; opciones: string; qty: number };

export type Dibujo = "taza" | "vaso" | "metodo" | "botella" | "masita" | "bolsa";

export const SECCIONES: { id: string; nombre: string; foto?: string; dibujo: Dibujo }[] = [
  { id: "Bebidas calientes", nombre: "Cafés calientes", foto: "latte", dibujo: "taza" },
  { id: "Bebidas frías", nombre: "Cafés fríos", foto: "iced-latte", dibujo: "vaso" },
  { id: "Pastelería", nombre: "Masitas", foto: "croissant", dibujo: "masita" },
  { id: "Café para llevar", nombre: "Café en bolsa", dibujo: "bolsa" },
  { id: "Métodos", nombre: "Café filtrado", dibujo: "metodo" },
  { id: "Otros", nombre: "Bebidas", foto: "limonada", dibujo: "botella" },
  { id: "Tienda", nombre: "Para tu casa", dibujo: "botella" },
];

const esCafe = (i: ItemTotem) => i.categoria === "grano" || i.categoria === "molido";
/** Los productos de la tienda que el admin suma al tótem (jarabes, equipos…) van en "Para tu casa". */
export const seccionDe = (i: ItemTotem) => (i.categoria === "bebida" ? i.grupo ?? "Otros" : esCafe(i) ? "Café para llevar" : "Tienda");

/** Si todavía no hay ventas suficientes, estos completan "Populares". */
export const POPULARES = ["Cappuccino", "Latte", "Croissant", "Iced Latte", "Espresso", "Cheesecake"];

const RUTA = "/totem/productos/";
const FOTOS: Record<string, string> = {
  espresso: "espresso",
  americano: "americano",
  cappuccino: "cappuccino",
  latte: "latte",
  "flat-white": "flat-white",
  macchiato: "macchiato",
  mocaccino: "mocaccino",
  "chocolate-caliente": "chocolate-caliente",
  "matcha-latte": "matcha-latte",
  "iced-latte": "iced-latte",
  "cold-brew": "cold-brew",
  "americano-helado": "americano-helado",
  "mocaccino-helado": "mocaccino-helado",
  "macchiato-de-caramelo": "macchiato-helado",
  "matcha-helado": "matcha-helado",
  limonada: "limonada",
  "jugo-de-naranja": "jugo-naranja",
  "te-helado-de-durazno": "te-helado",
  mocochinchi: "mocochinchi",
  croissant: "croissant",
  cunape: "cunape",
  brownie: "brownie",
  cheesecake: "cheesecake",
  "empanada-de-queso": "empanada-queso",
  alfajor: "alfajor",
  "galleta-con-chispas": "galleta-chispas",
};

/** Fotos ya recortadas: el admin puede elegirlas para un producto de la barra. */
export const GALERIA_TOTEM = Object.values(FOTOS).map((archivo) => ({ src: `${RUTA}${archivo}.webp` }));
export const esRecorte = (src: string) => src.startsWith(RUTA);

const DESCRIPCIONES: Record<string, string> = {
  espresso: "Corto e intenso, con crema dorada",
  americano: "Espresso largo con agua caliente",
  cappuccino: "Leche vaporizada y mucha espuma",
  latte: "Espresso con leche cremosa y arte latte",
  "flat-white": "Doble espresso con leche sedosa",
  macchiato: "Espresso manchado con espuma de leche",
  mocaccino: "Espresso, chocolate, leche y crema",
  "chocolate-caliente": "Chocolate espeso con malvaviscos",
  "matcha-latte": "Té matcha con leche vaporizada",
  "iced-latte": "Espresso con leche fría y hielo",
  "cold-brew": "Extraído en frío, dulce y limpio",
  affogato: "Helado de vainilla con espresso encima",
  "frappe-de-caramelo": "Café helado con caramelo y crema batida",
  v60: "Filtrado a mano, limpio y aromático",
  chemex: "Filtrado para compartir, muy suave",
  croissant: "De mantequilla, hojaldrado y crocante",
  cunape: "Pancitos de almidón y queso, tres unidades",
  brownie: "Chocolate intenso, húmedo por dentro",
  cheesecake: "Horneado, con salsa de frutos rojos",
  "empanada-de-queso": "Masa dorada rellena de queso",
  alfajor: "Con dulce de leche y coco rallado",
  "galleta-con-chispas": "Horneada, con chispas de chocolate",
  "agua-mineral": "Botella de 500 ml",
};

export const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const rutaFoto = (archivo: string) => `${RUTA}${archivo}.webp`;

/** La foto recortada del producto, o null si hay que dibujarlo. */
export function fotoDe(i: ItemTotem): string | null {
  if (i.foto?.src) return i.foto.src;
  const f = FOTOS[slug(i.nombre)];
  return f ? rutaFoto(f) : null;
}

export const descripcionDe = (i: ItemTotem) =>
  i.categoria !== "bebida" ? i.presentacion ?? (esCafe(i) ? "Bolsa de 250 g" : i.descripcion) : i.descripcion?.trim() || DESCRIPCIONES[slug(i.nombre)] || "";

export function dibujoDe(i: ItemTotem): Dibujo {
  if (slug(i.nombre).startsWith("mate") || slug(i.nombre).startsWith("te-")) return "taza";
  return SECCIONES.find((s) => s.id === seccionDe(i))?.dibujo ?? "taza";
}

// ---------- Opciones (sin costo extra) ----------
const CON_LECHE = new Set(["cappuccino", "latte", "flat-white", "macchiato", "mocaccino", "chocolate-caliente", "matcha-latte", "iced-latte", "frappe-de-caramelo", "frappe-de-chocolate", "mocaccino-helado", "macchiato-de-caramelo", "matcha-helado"]);
const SIN_AZUCAR = new Set(["affogato", "espresso-tonica"]);
const CON_HIELO = new Set(["limonada", "jugo-de-naranja", "te-helado-de-durazno", "mocochinchi"]);

/** Grupos de opciones de un producto. La primera de cada grupo es la normal. */
export function opcionesDe(i: ItemTotem): { titulo: string; valores: string[] }[] {
  if (i.categoria !== "bebida") {
    const m = (i.moliendas ?? []).filter((x) => x !== "Única");
    return m.length ? [{ titulo: "Molienda", valores: m }] : [];
  }
  const s = slug(i.nombre);
  const bebida = ["Bebidas calientes", "Bebidas frías", "Métodos"].includes(seccionDe(i));
  const grupos: { titulo: string; valores: string[] }[] = [];
  if (CON_LECHE.has(s)) grupos.push({ titulo: "Leche", valores: ["Leche entera", "Leche de avena"] });
  if (bebida && !SIN_AZUCAR.has(s)) grupos.push({ titulo: "Azúcar", valores: ["Azúcar normal", "Sin azúcar", "Extra azúcar"] });
  if (CON_HIELO.has(s)) grupos.push({ titulo: "Hielo", valores: ["Con hielo", "Sin hielo"] });
  return grupos;
}

/** Texto de lo elegido. En bebidas solo se anota lo que sale de lo normal; "" = tal cual. */
export function textoOpciones(i: ItemTotem, elegidas: string[]): string {
  const grupos = opcionesDe(i);
  if (i.categoria !== "bebida") return grupos.length ? elegidas[0] ?? grupos[0].valores[0] : "";
  return grupos.map((g, k) => (elegidas[k] && elegidas[k] !== g.valores[0] ? elegidas[k] : "")).filter(Boolean).join(" · ");
}

/** Precio corto para las tarjetas: "Bs 14" (con decimales solo si los tiene). */
export const precioCorto = (n: number) => `Bs ${n.toLocaleString("es-BO", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;

export const porDefecto = (i: ItemTotem) => opcionesDe(i).map((g) => g.valores[0]);

// ---------- Movimiento ----------
export const sinMovimiento = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** La foto "vuela" desde donde se tocó hasta Mi pedido. */
export function volarAlPedido(desde: Element | null, hasta: Element | null) {
  if (!desde || !hasta || sinMovimiento()) return;
  const a = desde.getBoundingClientRect();
  const b = hasta.getBoundingClientRect();
  const copia = desde.cloneNode(true) as HTMLElement;
  Object.assign(copia.style, { position: "fixed", left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px`, margin: "0", zIndex: "60", pointerEvents: "none" });
  document.querySelector(".totem-app")?.appendChild(copia);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  copia
    .animate(
      [
        { transform: "none", opacity: 1 },
        { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 70}px) scale(0.72)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.18)`, opacity: 0.2 },
      ],
      { duration: 620, easing: "cubic-bezier(0.4, 0, 0.3, 1)" },
    )
    .finished.finally(() => copia.remove());
}
