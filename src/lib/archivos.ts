import { supabase } from "@/lib/supabase";

/**
 * Subida de archivos a Supabase Storage (ver supabase/migrations/009_fotos_y_pagos.sql):
 *  - "fotos" (pública): fotos de productos y subastas. Solo el admin sube.
 *  - "comprobantes" (privada): el comprobante de pago de cada cliente, en su carpeta.
 *  - "entregas" (privada, ver 010): la foto que toma el repartidor al dejar el pedido.
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
export async function enviarComprobante(
  archivo: File,
  id: number,
  /** Un pedido de la tienda o un cobro del Club: el recorrido es el mismo, cambia la función. */
  destino: "pedido" | "club" = "pedido",
): Promise<void> {
  const error = revisarArchivo(archivo, true);
  if (error) throw new Error(error);
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Tu sesión se cerró. Entra de nuevo para enviar el comprobante.");
  const blob = archivo.type === "application/pdf" ? archivo : await achicar(archivo);
  const ruta = `${data.user.id}/${destino === "club" ? "club-" : ""}${id}-${Date.now()}.${extension(blob)}`;
  const { error: e } = await supabase.storage.from("comprobantes").upload(ruta, blob, { contentType: blob.type });
  if (e) throw new Error(/bucket not found/i.test(e.message) ? 'Falta la carpeta "comprobantes" en Supabase: corre la migración 009.' : e.message);
  const { error: r } =
    destino === "club"
      ? await supabase.rpc("enviar_comprobante_club", { p_cobro: id, p_ruta: ruta })
      : await supabase.rpc("enviar_comprobante", { p_pedido: id, p_ruta: ruta });
  if (r) throw new Error(r.message);
}

/**
 * Sube la foto de una entrega y devuelve su ruta (no una URL: el bucket es privado).
 *
 * La foto va a la carpeta del cliente para que él mismo pueda verla desde Mi cuenta; las
 * compras sin cuenta van a "sin-cliente", que solo abre el equipo, porque no hay a quién
 * mostrársela.
 */
export async function subirEntrega(archivo: File, pedidoId: number, clienteId: string | null): Promise<string> {
  const error = revisarArchivo(archivo);
  if (error) throw new Error(error);
  return subirAEntregas(await achicar(archivo), pedidoId, clienteId, "foto");
}

/**
 * Sube la firma de quien recibe. Viene del recuadro de firma como Blob, no como File, así
 * que no pasa por revisarArchivo: ya la generó la propia aplicación y pesa unos pocos KB.
 */
export async function subirFirma(firma: Blob, pedidoId: number, clienteId: string | null): Promise<string> {
  return subirAEntregas(firma, pedidoId, clienteId, "firma");
}

async function subirAEntregas(blob: Blob, pedidoId: number, clienteId: string | null, tipo: string): Promise<string> {
  const ruta = `${clienteId ?? "sin-cliente"}/${pedidoId}-${tipo}-${Date.now()}.${extension(blob)}`;
  const { error } = await supabase.storage.from("entregas").upload(ruta, blob, { contentType: blob.type });
  if (error) {
    if (/bucket not found/i.test(error.message)) throw new Error('Falta la carpeta "entregas" en Supabase: corre la migración 010.');
    throw new Error(/row-level security|unauthorized/i.test(error.message) ? "Solo el repartidor, desde su cuenta, puede registrar entregas." : error.message);
  }
  return ruta;
}

/**
 * Enlace temporal para ver un archivo de un bucket privado.
 *
 * Dura 10 minutos: suficiente para mirarlo o descargarlo, poco para que el enlace siga
 * sirviendo si alguien lo reenvía. Los comprobantes y las fotos de entrega llevan datos
 * personales, así que no se exponen con una URL permanente.
 */
export async function verArchivoPrivado(bucket: "comprobantes" | "entregas", ruta: string): Promise<string | null> {
  const { data } = await supabase.storage.from(bucket).createSignedUrl(ruta, 600);
  return data?.signedUrl ?? null;
}

/** Atajo histórico: el comprobante de pago de un pedido. */
export const verComprobante = (ruta: string) => verArchivoPrivado("comprobantes", ruta);
