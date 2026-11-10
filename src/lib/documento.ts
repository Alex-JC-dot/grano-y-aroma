/**
 * Utilidades comunes a los documentos que el sistema entrega: comprobantes de compra y de
 * venta, cierres de caja y reportes, tanto en PDF como en Excel.
 *
 * El PDF se produce imprimiendo (ver imprimir.css). El navegador ofrece "Guardar como PDF"
 * en su propio diálogo, así que no hace falta ninguna librería de PDF: cero dependencias,
 * cero kilobytes en el bundle y funciona sin internet.
 */

export const EMPRESA = {
  nombre: "Grano y Aroma",
  rubro: "Café de especialidad",
  direccion: "Centro histórico, Sucre, Bolivia",
  whatsapp: "+591 742 12541",
  correo: "alexcalatayud@gmail.com",
} as const;

/** Fecha y hora larga: "9 de noviembre de 2026, 21:54". */
export function fechaHoraLarga(d: Date = new Date()): string {
  const fecha = d.toLocaleDateString("es-BO", { day: "numeric", month: "long", year: "numeric" });
  const hora = d.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${fecha}, ${hora}`;
}

/**
 * Fecha corta en hora LOCAL: "2026-11-09".
 *
 * No usa toISOString(), que convierte a UTC: a las 22:39 en Bolivia (UTC-4) ya son las
 * 02:39 del día siguiente en UTC, y el número del documento salía con una fecha distinta
 * a la que el propio documento imprimía debajo.
 */
export function fechaISO(d: Date = new Date()): string {
  const anio = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

/**
 * Nombre de archivo descriptivo y ordenable:
 * nombreArchivo("ventas", "xlsx") → "grano-y-aroma-ventas-2026-11-09.xlsx"
 */
export function nombreArchivo(concepto: string, extension: string, d: Date = new Date()): string {
  const limpio = concepto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `grano-y-aroma-${limpio}-${fechaISO(d)}.${extension}`;
}

/**
 * Número correlativo de documento: numeroDocumento("GA") → "GA-483921".
 *
 * Vive aquí, fuera de los componentes, por una razón concreta: el linter de React marca
 * Date.now() dentro de un componente como función impura, porque un render que se repita
 * daría un número distinto. Llamada desde un manejador de evento y definida fuera, el
 * número se calcula una sola vez, cuando la venta ocurre.
 *
 * Con la hora basta para la demostración. Con una base de datos detrás, el correlativo lo
 * dará la propia base, que es quien puede garantizar que no se repita.
 */
export function numeroDocumento(prefijo: string, digitos = 6): string {
  return `${prefijo}-${Date.now().toString().slice(-digitos)}`;
}

/**
 * Abre el diálogo de impresión para generar el PDF.
 *
 * El título del documento importa más de lo que parece: el navegador lo propone como nombre
 * del archivo al guardar como PDF. Sin esto saldría "localhost" o el título de la página.
 * Se restaura después para no dejar la pestaña renombrada.
 *
 * El doble requestAnimationFrame da al navegador el tiempo de pintar el documento recién
 * montado antes de congelar la vista de impresión; sin esa espera, en Chrome a veces sale
 * la hoja en blanco.
 */
export function imprimirDocumento(titulo: string): void {
  const original = document.title;
  document.title = titulo;

  const restaurar = () => {
    document.title = original;
    window.removeEventListener("afterprint", restaurar);
  };
  window.addEventListener("afterprint", restaurar);

  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      window.print();
      // Safari no siempre dispara afterprint: red de seguridad.
      window.setTimeout(restaurar, 1500);
    })
  );
}

/** Descarga un Blob ya construido con el nombre indicado. */
export function descargarBlob(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Liberar de inmediato cancelaría la descarga en Firefox.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
