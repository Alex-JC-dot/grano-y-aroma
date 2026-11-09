import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { supabase, type Perfil } from "@/lib/supabase";

/**
 * Sesión del usuario y "cuenta a demanda": la web no pide entrar al abrirla. Cuando una
 * acción necesita guardar algo (pagar, suscribirse, pujar…), el componente llama a
 * `pedirCuenta("motivo")`: si ya hay sesión devuelve true al instante; si no, abre la
 * ventana de cuenta y espera a que la persona entre o la cierre.
 */
interface AuthStore {
  session: Session | null;
  perfil: Perfil | null;
  cargando: boolean;
  modal: { motivo: string } | null;
  /** Mensaje breve de confirmación (p. ej. "cuenta creada"), visible aunque la ventana se cierre. */
  aviso: { titulo: string; texto: string } | null;
  avisar: (titulo: string, texto: string) => void;
  limpiarAviso: () => void;
  _resolver: ((ok: boolean) => void) | null;
  iniciar: () => () => void;
  cargarPerfil: () => Promise<void>;
  pedirCuenta: (motivo: string) => Promise<boolean>;
  cerrarModal: (ok: boolean) => void;
  salir: () => Promise<void>;
}

export const useAuth = create<AuthStore>((set, get) => ({
  session: null,
  perfil: null,
  cargando: true,
  modal: null,
  aviso: null,
  _resolver: null,
  avisar: (titulo, texto) => set({ aviso: { titulo, texto } }),
  limpiarAviso: () => set({ aviso: null }),

  iniciar: () => {
    supabase.auth.getSession().then(({ data }) => {
      set({ session: data.session });
      if (data.session) get().cargarPerfil();
      else set({ cargando: false });
    });
    const { data } = supabase.auth.onAuthStateChange((_evento, session) => {
      set({ session });
      if (session) get().cargarPerfil();
      else set({ perfil: null, cargando: false });
    });
    return () => data.subscription.unsubscribe();
  },

  cargarPerfil: async () => {
    const id = get().session?.user.id;
    if (!id) return;
    const { data } = await supabase.from("perfiles").select("*").eq("id", id).maybeSingle();
    set({ perfil: (data as Perfil) ?? null, cargando: false });
  },

  pedirCuenta: (motivo) => {
    if (get().session) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => set({ modal: { motivo }, _resolver: resolve }));
  },

  cerrarModal: (ok) => {
    get()._resolver?.(ok);
    set({ modal: null, _resolver: null });
  },

  salir: async () => {
    await supabase.auth.signOut();
    set({ session: null, perfil: null });
  },
}));
