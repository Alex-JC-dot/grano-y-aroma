"use client";

import { useEffect, useRef, useState } from "react";
import { enviarComprobante } from "@/lib/archivos";
import { qrDePago } from "@/lib/qr-emvco";
import { formatBs } from "@/lib/utils";

/**
 * Pago por QR de un pedido: el código para pagar y el envío del comprobante.
 * Se usa al confirmar la compra (carrito) y después desde Mi cuenta, mientras el pago esté
 * pendiente o haya sido rechazado.
 *
 * El QR es de demostración: codifica el pedido y el monto, no una cuenta bancaria real.
 */

export type PagoEstado = "no_aplica" | "pendiente" | "por_verificar" | "aprobado" | "rechazado";

export const TEXTO_PAGO: Record<PagoEstado, string> = {
  no_aplica: "",
  pendiente: "Falta el comprobante",
  por_verificar: "Comprobante en revisión",
  aprobado: "Pago aprobado",
  rechazado: "Comprobante rechazado",
};

/**
 * QR del cobro, en formato EMVCo: lo que leen las apps de los bancos (ver lib/qr-emvco.ts).
 * Antes llevaba una frase suelta y ninguna app lo reconocía como un pago.
 */
export function QrPago({ codigo, total, concepto = "Pedido" }: { codigo: string; total: number; concepto?: string }) {
  const [svg, setSvg] = useState("");

  useEffect(() => {
    let vivo = true;
    // Corrección de errores alta: estos QR se escanean de una pantalla, muchas veces con
    // reflejos encima, y conviene que se lean aunque una parte se vea mal.
    import("qrcode").then((qr) =>
      qr
        .toString(qrDePago(total, `${concepto} ${codigo}`), {
          type: "svg",
          margin: 1,
          errorCorrectionLevel: "M",
          color: { dark: "#2a1f1a", light: "#ffffff" },
        })
        .then((s) => vivo && setSvg(s)),
    );
    return () => {
      vivo = false;
    };
  }, [codigo, total, concepto]);

  return (
    <figure className="pago-qr">
      <div className="pago-qr__codigo" role="img" aria-label={`Código QR para pagar ${formatBs(total)}`} dangerouslySetInnerHTML={{ __html: svg }} />
      <figcaption>
        Escanéalo desde la app de tu banco y paga <strong>{formatBs(total)}</strong>.
      </figcaption>
    </figure>
  );
}

/** Botón para elegir y enviar el comprobante (foto o PDF). */
export function SubirComprobante({
  pedidoId,
  estado,
  nota,
  alEnviar,
  destino = "pedido",
}: {
  /** Id del pedido, o del cobro del Club cuando destino es "club". */
  pedidoId: number;
  estado: PagoEstado;
  nota?: string | null;
  alEnviar?: () => void;
  destino?: "pedido" | "club";
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [enviado, setEnviado] = useState(false);

  if (enviado || estado === "por_verificar") {
    return (
      <p className="pago-aviso pago-aviso--revision" role="status">
        <strong>Recibimos tu comprobante.</strong>{" "}
        {destino === "club"
          ? "Lo revisamos y, cuando el pago esté aprobado, programamos tu envío."
          : "Lo revisamos y, cuando el pago esté aprobado, empezamos a preparar tu pedido."}
      </p>
    );
  }
  if (estado !== "pendiente" && estado !== "rechazado") return null;

  const elegir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    setError("");
    setEnviando(true);
    try {
      await enviarComprobante(archivo, pedidoId, destino);
      setEnviado(true);
      alEnviar?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el comprobante.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="pago-subir">
      {estado === "rechazado" && (
        <p className="pago-aviso pago-aviso--rechazo" role="alert">
          <strong>Rechazamos el comprobante anterior.</strong> {nota ? `Motivo: ${nota}. ` : ""}Envía uno nuevo.
        </p>
      )}
      <input ref={entrada} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden onChange={elegir} />
      <button type="button" className="btn btn--primary" disabled={enviando} onClick={() => entrada.current?.click()}>
        {enviando ? "Enviando…" : estado === "rechazado" ? "Enviar otro comprobante" : "Subir comprobante de pago"}
      </button>
      <small className="pago-subir__ayuda">Captura de pantalla o PDF del pago, de hasta 5 MB.</small>
      {error && <p className="carrito__error" role="alert">{error}</p>}
    </div>
  );
}
