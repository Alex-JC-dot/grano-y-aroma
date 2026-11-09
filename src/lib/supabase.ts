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

export const supabase = createClient(url ?? "http://localhost", clave ?? "falta-clave", {
  auth: { persistSession: true, autoRefreshToken: true },
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
  admin: ["/admin", "/pos", "/erp", "/logistica"],
};

/** Traduce los errores de Supabase Auth a mensajes claros en español. */
export function mensajeDeError(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  if (/invalid login credentials/i.test(m)) return "El correo o la contraseña no coinciden.";
  if (/email not confirmed/i.test(m)) return "Confirma tu correo: te enviamos un enlace al registrarte.";
  if (/already registered|already been registered/i.test(m)) return "Ese correo ya tiene una cuenta. Entra con tu contraseña.";
  if (/password should be at least/i.test(m)) return "La contraseña debe tener al menos 6 caracteres.";
  if (/rate limit/i.test(m)) return "Demasiados intentos. Espera un minuto y vuelve a probar.";
  if (/fetch|network/i.test(m)) return "No pudimos conectar con el servidor. Revisa tu conexión.";
  return m;
}
