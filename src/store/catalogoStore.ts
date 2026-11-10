import { useEffect } from "react";
import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { catalogoInicial, productosDePrueba } from "@/lib/data";
import type { Categoria, FotoProducto, Product } from "@/lib/types";

/**
 * Catálogo de la tienda desde Supabase (RF-01, RF-05). Mientras carga se muestra la copia que
 * viene en la página (la misma que se cargó en la base), así la tienda nunca aparece vacía;
 * al llegar los datos se actualizan precio, stock y productos nuevos. Con Realtime, si alguien
 * compra lo último, la tarjeta pasa a "Agotado" sin recargar.
 */

export type FilaProducto = {
  id: string;
  nombre: string;
  categoria: Categoria;
  descripcion: string;
  presentacion: string | null;
  precio: number;
  stock: number;
  stock_minimo: number;
  origen: string | null;
  region: string | null;
  altitud: number | null;
  tueste: string | null;
  perfil: string[] | null;
  codigo_lote: string | null;
  puntaje: number | null;
  fecha_tueste: string | null;
  activo: boolean;
  moliendas: string[] | null;
  foto: FotoProducto | null;
  color: string | null;
  orden: number;
  grupo: string | null;
};

const TUESTES = ["Ligero", "Medio", "Oscuro"] as const;

export function aProducto(f: FilaProducto): Product {
  return {
    id: f.id,
    name: f.nombre,
    categoria: f.categoria,
    presentacion: f.presentacion ?? undefined,
    origin: f.origen ?? "",
    region: f.region ?? "",
    altitude: f.altitud ?? 0,
    roastLevel: (TUESTES as readonly string[]).includes(f.tueste ?? "") ? (f.tueste as Product["roastLevel"]) : "Medio",
    flavorProfile: f.perfil ?? [],
    grindTypes: f.moliendas?.length ? f.moliendas : ["Única"],
    lotCode: f.codigo_lote ?? "",
    cuppingScore: f.puntaje == null ? 0 : Number(f.puntaje),
    cuppingNotes: f.descripcion,
    roastDate: f.fecha_tueste ?? "",
    price: Number(f.precio),
    stock: f.stock,
    imageUrl: "",
    foto: f.foto ?? undefined,
    color: f.color ?? undefined,
  };
}

interface CatalogoStore {
  productos: Product[];
  cargado: boolean;
  iniciar: () => void;
}

let iniciado = false;

export const useCatalogo = create<CatalogoStore>((set) => ({
  productos: [...catalogoInicial, ...productosDePrueba],
  cargado: false,

  iniciar: () => {
    if (iniciado) return;
    iniciado = true;

    const cargar = async () => {
      const { data, error } = await supabase
        .from("productos")
        .select("*")
        .eq("activo", true)
        .neq("categoria", "bebida") // la barra se vende en la caja, no en la tienda
        .order("orden")
        .order("creado_en");
      if (error || !data) return; // sin conexión: queda la copia de la página
      set({ productos: [...(data as FilaProducto[]).map(aProducto), ...productosDePrueba], cargado: true });
    };
    cargar();

    supabase
      .channel("catalogo")
      .on("postgres_changes", { event: "*", schema: "public", table: "productos" }, () => cargar())
      .subscribe();
  },
}));

/** Productos de la tienda, ya conectados a la base. */
export function useProductos() {
  const iniciar = useCatalogo((s) => s.iniciar);
  useEffect(() => iniciar(), [iniciar]);
  return useCatalogo((s) => s.productos);
}
