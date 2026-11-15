import { supabase } from "@/lib/supabase";

/**
 * Subida de archivos a Supabase Storage (ver supabase/migrations/009_fotos_y_pagos.sql):
 *  - "fotos" (pública): fotos de productos y subastas. Solo el admin sube.
 *  - "comprobantes" (privada): el comprobante de pago de cada cliente, en su carpeta.
 *
 * Las imágenes se achican en el navegador antes de subir (máx. 1600 px, WebP): una foto de
 * celular de 4 MB queda en ~200 KB, la tienda carga rápido y no se llena el almacenamiento.
 */

const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp"];
const MAX_MB = 5;

/** Revisa tipo y peso. Devuelve el mensaje de error o null si está bien. */
export function revisarArchivo(archivo: File, permitirPdf = false): string | null {
  const tipos = permitirPdf ? [...TIPOS_IMAGEN, "application/pdf"] : TIPOS_IMAGEN;
  if (!tipos.includes(archivo.type)) return permitirPdf ? "Sube una foto (JPG, PNG o WebP) o un PDF." : "Sube una foto en JPG, PNG o WebP.";
  if (archivo.size > MAX_MB * 1024 * 1024) return `El archivo pesa más de ${MAX_MB} MB.`;
  return null;
}

/** Achica la imagen a `max` px por lado y la convierte a WebP. Si algo falla, devuelve la original. */
async function achicar(archivo: File, max = 1600): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(archivo);
    const escala = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * escala);
    canvas.height = Math.round(bmp.height * escala);
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/webp", 0.85));
    return blob && blob.size < archivo.size ? blob : archivo;
  } catch {
    return archivo;
  }
}

const extension = (b: Blob) => (b.type === "image/webp" ? "webp" : b.type === "image/png" ? "png" : b.type === "application/pdf" ? "pdf" : "jpg");

/** Sube una foto de producto o subasta y devuelve su URL pública. */
export async function subirFoto(archivo: File, carpeta: "productos" | "subastas"): Promise<string> {
  const error = revisarArchivo(archivo);
  if (error) throw new Error(error);
  const blob = await achicar(archivo);
  const ruta = `${carpeta}/${crypto.randomUUID()}.${extension(blob)}`;
  const { error: e } = await supabase.storage.from("fotos").upload(ruta, blob, { contentType: blob.type, cacheControl: "31536000" });
  if (e) throw new Error(/row-level security|unauthorized/i.test(e.message) ? "Solo el administrador puede subir fotos." : e.message);
  return supabase.storage.from("fotos").getPublicUrl(ruta).data.publicUrl;
}

/** Sube el comprobante del pedido y lo deja "por verificar". */
export async function enviarComprobante(archivo: File, pedidoId: number): Promise<void> {
  const error = revisarArchivo(archivo, true);
  if (error) throw new Error(error);
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Tu sesión se cerró. Entra de nuevo para enviar el comprobante.");
  const blob = archivo.type === "application/pdf" ? archivo : await achicar(archivo);
  const ruta = `${data.user.id}/${pedidoId}-${Date.now()}.${extension(blob)}`;
  const { error: e } = await supabase.storage.from("comprobantes").upload(ruta, blob, { contentType: blob.type });
  if (e) throw new Error(e.message);
  const { error: r } = await supabase.rpc("enviar_comprobante", { p_pedido: pedidoId, p_ruta: ruta });
  if (r) throw new Error(r.message);
}

/** Enlace temporal (10 min) para que el equipo vea un comprobante privado. */
export async function verComprobante(ruta: string): Promise<string | null> {
  const { data } = await supabase.storage.from("comprobantes").createSignedUrl(ruta, 600);
  return data?.signedUrl ?? null;
}
