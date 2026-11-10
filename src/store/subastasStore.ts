import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/store/authStore";

/**
 * Subastas en vivo (RF-10 a RF-16) desde Supabase:
 *  · carga los lotes y se suscribe a Realtime: cuando alguien puja, la fila de la subasta
 *    cambia y todos los navegadores la reciben al instante (RNF-02);
 *  · las pujas pasan por realizar_puja(), que bloquea el lote en la base (RNF-09);
 *  · si ibas primero y otro te supera, aparece el aviso "Te superaron" (RF-13).
 */

export type Subasta = {
  id: number;
  titulo: string;
  descripcion: string;
  origen: string;
  altitud: number | null;
  cantidad_kg: number | null;
  puntaje: number | null;
  codigo_lote: string | null;
  imagen: string | null;
  imagen_alt: string | null;
  precio_base: number;
  incremento: number;
  puja_actual: number | null;
  lider_id: string | null;
  lider_nombre: string | null;
  num_pujas: number;
  abre_en: string;
  cierra_en: string;
  estado: "proxima" | "activa" | "cerrada";
  ganador_nombre: string | null;
  variedad: string | null;
  proceso: string | null;
  cosecha: string | null;
  finca: string | null;
  historia: string | null;
  catacion: [string, number][] | null;
};

export type Puja = { id: number; monto: number; creado_en: string; postor: string; es_mia: boolean };
export type AvisoSubasta = { tipo: "ok" | "superado"; titulo: string; texto: string };

interface SubastasStore {
  subastas: Subasta[];
  pujas: Record<number, Puja[]>;
  avisos: Set<number>;
  cargando: boolean;
  error: string;
  ahora: number;
  aviso: AvisoSubasta | null;
  conectar: () => () => void;
  cargarPujas: (id: number) => Promise<void>;
  cargarAvisos: () => Promise<void>;
  pujar: (id: number, monto: number) => Promise<string | null>;
  alternarAviso: (id: number) => Promise<void>;
  tick: () => void;
  setAviso: (a: AvisoSubasta | null) => void;
}

const normalizar = (s: Subasta): Subasta => ({
  ...s,
  precio_base: Number(s.precio_base),
  incremento: Number(s.incremento),
  puja_actual: s.puja_actual == null ? null : Number(s.puja_actual),
  cantidad_kg: s.cantidad_kg == null ? null : Number(s.cantidad_kg),
  puntaje: s.puntaje == null ? null : Number(s.puntaje),
});

/** Puja mínima permitida, igual que en realizar_puja(). */
export const minimoDe = (s: Subasta) => (s.puja_actual == null ? s.precio_base : s.puja_actual + s.incremento);
/** Segundos que faltan para cerrar (o para abrir, si es próxima). */
export const segundosA = (iso: string, ahora: number) => Math.max(0, Math.floor((new Date(iso).getTime() - ahora) / 1000));
/** Abierta para pujar ahora mismo (el estado de la base puede tardar hasta un minuto en cambiar). */
export const abierta = (s: Subasta, ahora: number) =>
  s.estado !== "cerrada" && new Date(s.abre_en).getTime() <= ahora && new Date(s.cierra_en).getTime() > ahora;
export const nombreCorto = (titulo: string) => titulo.split(" — ")[0];

export const useSubastas = create<SubastasStore>((set, get) => ({
  subastas: [],
  pujas: {},
  avisos: new Set(),
  cargando: true,
  error: "",
  ahora: Date.now(),
  aviso: null,

  conectar: () => {
    const cargar = async () => {
      const { data, error } = await supabase.from("subastas").select("*").order("cierra_en", { ascending: true });
      if (error) return set({ error: "No pudimos cargar las subastas. Revisa tu conexión.", cargando: false });
      const lista = (data as Subasta[]).map(normalizar);
      set({ subastas: lista, cargando: false, error: "" });
      lista.filter((s) => s.estado !== "proxima").forEach((s) => get().cargarPujas(s.id));
    };
    cargar();
    get().cargarAvisos();

    const canal = supabase
      .channel(`subastas-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "subastas" }, (cambio) => {
        if (cambio.eventType === "DELETE") {
          const id = (cambio.old as { id: number }).id;
          return set((st) => ({ subastas: st.subastas.filter((s) => s.id !== id) }));
        }
        const nueva = normalizar(cambio.new as Subasta);
        const antes = get().subastas.find((s) => s.id === nueva.id);
        const yo = useAuth.getState().session?.user.id;
        set((st) => ({
          subastas: antes ? st.subastas.map((s) => (s.id === nueva.id ? nueva : s)) : [...st.subastas, nueva],
        }));
        if (nueva.num_pujas !== antes?.num_pujas) get().cargarPujas(nueva.id);
        if (yo && antes?.lider_id === yo && nueva.lider_id && nueva.lider_id !== yo) {
          get().setAviso({
            tipo: "superado",
            titulo: "Te superaron",
            texto: `${nueva.lider_nombre ?? "Otro postor"} pujó ${nueva.puja_actual} Bs. en ${nombreCorto(nueva.titulo)}. Puedes volver a pujar.`,
          });
        }
      })
      .subscribe();

    // Al entrar o salir de la cuenta cambian "mis pujas" y "mis avisos".
    const dejar = useAuth.subscribe((st, previo) => {
      if (st.session?.user.id === previo.session?.user.id) return;
      get().cargarAvisos();
      get().subastas.filter((s) => s.estado !== "proxima").forEach((s) => get().cargarPujas(s.id));
    });

    return () => {
      supabase.removeChannel(canal);
      dejar();
    };
  },

  cargarPujas: async (id) => {
    const { data } = await supabase.rpc("pujas_de", { p_subasta: id });
    if (!data) return;
    const lista = (data as Puja[]).map((p) => ({ ...p, monto: Number(p.monto) }));
    set((st) => ({ pujas: { ...st.pujas, [id]: lista } }));
  },

  cargarAvisos: async () => {
    if (!useAuth.getState().session) return set({ avisos: new Set() });
    const { data } = await supabase.from("avisos_subasta").select("subasta_id");
    set({ avisos: new Set((data ?? []).map((a: { subasta_id: number }) => a.subasta_id)) });
  },

  pujar: async (id, monto) => {
    const { data, error } = await supabase.rpc("realizar_puja", { p_subasta: id, p_monto: monto });
    if (error) {
      const m = error.message;
      if (/no está abierta/i.test(m)) return "Esta subasta ya no está abierta.";
      if (/Ya vas primero/i.test(m)) return "Ya vas primero en este lote: espera a que alguien te supere.";
      if (/puja mínima/i.test(m)) return `${m}. Alguien pujó antes que tú.`;
      if (/iniciar sesión/i.test(m)) return "Tu sesión se cerró. Entra de nuevo para pujar.";
      return "No pudimos registrar tu puja. Revisa tu conexión y vuelve a intentar.";
    }
    const nueva = normalizar(data as Subasta);
    set((st) => ({ subastas: st.subastas.map((s) => (s.id === id ? nueva : s)) }));
    get().cargarPujas(id);
    return null;
  },

  alternarAviso: async (id) => {
    const tiene = get().avisos.has(id);
    const { error } = tiene
      ? await supabase.from("avisos_subasta").delete().eq("subasta_id", id)
      : await supabase.from("avisos_subasta").insert({ subasta_id: id });
    if (error) return;
    set((st) => {
      const n = new Set(st.avisos);
      if (tiene) n.delete(id);
      else n.add(id);
      return { avisos: n };
    });
  },

  tick: () => set({ ahora: Date.now() }),
  setAviso: (a) => set({ aviso: a }),
}));

