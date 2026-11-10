import { createClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase para el navegador. Usa solo la clave pública (publishable/anon):
 * lo que cada usuario puede leer o cambiar lo deciden las políticas RLS de la base
 * (supabase/migrations). La clave secreta nunca va en el frontend.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !clave) {
  // En el build sin .env.local la web sigue funcionando en modo demostración.
  console.warn("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (.env.local)");
}

/**
 * "Recordarme": con la casilla marcada la sesión se guarda en localStorage (sigue al cerrar el
 * navegador); sin marcar, en sessionStorage (se borra al cerrarlo).
 */
const CLAVE_RECORDAR = "ga-recordar";
const recordando = () => {
  try {
    return localStorage.getItem(CLAVE_RECORDAR) !== "0";
  } catch {
    return true;
  }
};
export function recordarSesion(si: boolean) {
  try {
    localStorage.setItem(CLAVE_RECORDAR, si ? "1" : "0");
  } catch {
    // Sin almacenamiento: la sesión dura lo que dure la página.
  }
}
const almacen = {
  getItem: (k: string) => {
    try {
      return localStorage.getItem(k) ?? sessionStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k: string, v: string) => {
    try {
      if (recordando()) {
        sessionStorage.removeItem(k);
        localStorage.setItem(k, v);
      } else {
        localStorage.removeItem(k);
        sessionStorage.setItem(k, v);
      }
    } catch {
      // Modo privado sin almacenamiento.
    }
  },
  removeItem: (k: string) => {
    try {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    } catch {
      // nada que borrar
    }
  },
};

export const supabase = createClient(url ?? "http://localhost", clave ?? "falta-clave", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: typeof window === "undefined" ? undefined : almacen,
  },
});

export type Rol = "cliente" | "cajero" | "tostador" | "admin";

export type Perfil = {
  id: string;
  nombre: string;
  telefono: string | null;
  direccion: string | null;
  rol: Rol;
  puntos: number;
};

/** Paneles que puede abrir cada rol (el admin, todos). */
export const PANELES: Record<Rol, string[]> = {
  cliente: [],
  cajero: ["/pos"],
  tostador: ["/erp"],
  admin: ["/admin", "/admin/productos", "/admin/subastas", "/admin/usuarios", "/pos", "/erp", "/logistica"],
};

/** Traduce los errores de Supabase Auth a mensajes claros en español. */
export function mensajeDeError(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  if (/invalid login credentials/i.test(m)) return "El correo o la contraseña no coinciden.";
  if (/email not confirmed/i.test(m)) return "Confirma tu correo: te enviamos un enlace al registrarte.";
  if (/already registered|already been registered/i.test(m)) return "Ese correo ya tiene una cuenta. Entra con tu contraseña.";
  if (/password should be at least/i.test(m)) return "La contraseña debe tener al menos 6 caracteres.";
  if (/rate limit/i.test(m)) return "Demasiados intentos. Espera un minuto y vuelve a probar.";
  if (/Producto .+ no disponible/i.test(m)) return "Uno de los productos ya no está disponible. Quítalo del carrito y vuelve a intentar.";
  if (/Necesitas iniciar sesión/i.test(m)) return "Tu sesión se cerró. Entra de nuevo.";
  if (/fetch|network/i.test(m)) return "No pudimos conectar con el servidor. Revisa tu conexión.";
  return m;
}
