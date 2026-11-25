import { formatBs } from "./utils";

/**
 * Baja el QR de pago como imagen, para quien compra desde el celular y no tiene otro con qué
 * escanear: la guarda y la abre desde su app. La imagen lleva la marca, el monto y el pedido.
 */
export async function descargarQr(enlace: string, total: number, referencia: string) {
  const { default: qr } = await import("qrcode");
  const codigo = document.createElement("canvas");
  await qr.toCanvas(codigo, enlace, { width: 720, margin: 1, errorCorrectionLevel: "M", color: { dark: "#2a1f1a", light: "#ffffff" } });

  const hoja = document.createElement("canvas");
  hoja.width = 900;
  hoja.height = 1200;
  const c = hoja.getContext("2d");
  if (!c) throw new Error("sin lienzo");
  // Las letras de la página; si el navegador no las da, una parecida.
  const letra = (variable: string, respaldo: string) => getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || getComputedStyle(document.body).getPropertyValue(variable).trim() || respaldo;
  const titulo = letra("--font-fraunces", "Georgia, serif");
  const texto = letra("--font-figtree", "system-ui, sans-serif");
  const escribir = (que: string, y: number, fuente: string, color: string) => {
    c.font = fuente;
    c.fillStyle = color;
    c.fillText(que, 450, y);
  };
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, 900, 1200);
  c.textAlign = "center";
  escribir("Grano y Aroma", 104, `400 60px ${titulo}`, "#2a1f1a");
  c.drawImage(codigo, 90, 150, 720, 720);
  escribir(formatBs(total), 975, `400 84px ${titulo}`, "#2a1f1a");
  escribir(referencia, 1046, `500 36px ${texto}`, "#5b4a40");
  escribir("QR de demostración: no se mueve dinero real", 1130, `400 28px ${texto}`, "#7b6a5f");

  const imagen = await new Promise<Blob>((listo, falla) => hoja.toBlob((b) => (b ? listo(b) : falla(new Error("sin imagen"))), "image/png"));
  const nombre = `QR ${referencia.replace(/[^\wáéíóúñ -]/gi, "")} - Grano y Aroma.png`;

  // En iPhone el enlace de descarga abre la imagen o la manda a Archivos: la hoja de compartir
  // tiene "Guardar imagen", que la deja en Fotos.
  const iphone = /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Mac/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  const archivo = new File([imagen], nombre, { type: "image/png" });
  if (iphone && navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo] });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return; // cerró la hoja sin guardar
    }
  }
  const url = URL.createObjectURL(imagen);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}
