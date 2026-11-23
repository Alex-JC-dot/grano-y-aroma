"use client";

import { useEffect, useState } from "react";
import { mensajeDeError, supabase } from "@/lib/supabase";
import { formatBs } from "@/lib/utils";

/**
 * Pago por QR de un pedido: el código para pagar y la confirmación AUTOMÁTICA del pago.
 * Se usa al confirmar la compra (carrito) y después desde Mi cuenta, mientras el pago esté
 * pendiente.
 *
 * Antes el cliente subía un comprobante y el admin lo aprobaba a mano. Ahora nadie del equipo
 * interviene: en un sistema real el banco avisa al instante cuando entra el pago (un
 * "webhook") y el pedido queda pagado solo. Aquí eso se simula: el cliente paga, toca "Ya
 * pagué" y el "banco" lo confirma (función pagar_qr de la migración 013).
 *
 * El QR es de demostración: codifica el pedido y el monto, no una cuenta bancaria real.
 */

export type PagoEstado = "no_aplica" | "pendiente" | "por_verificar" | "aprobado" | "rechazado";

export const TEXTO_PAGO: Record<PagoEstado, string> = {
  no_aplica: "",
  pendiente: "Esperando el pago",
  por_verificar: "Verificando el pago",
  aprobado: "Pago aprobado",
  rechazado: "Pago rechazado",
};

export function QrPago({ codigo, total }: { codigo: string; total: number }) {
  const [svg, setSvg] = useState("");

  useEffect(() => {
    let vivo = true;
    import("qrcode").then((qr) =>
      qr
        .toString(`GRANO Y AROMA | Pago de demostración | Pedido ${codigo} | Bs ${total.toFixed(2)}`, {
          type: "svg",
          margin: 1,
          color: { dark: "#2a1f1a", light: "#ffffff" },
        })
        .then((s) => vivo && setSvg(s)),
    );
    return () => {
      vivo = false;
    };
  }, [codigo, total]);

  return (
    <figure className="pago-qr">
      <div className="pago-qr__codigo" role="img" aria-label={`Código QR para pagar ${formatBs(total)}`} dangerouslySetInnerHTML={{ __html: svg }} />
      <figcaption>
        Escanéalo desde la app de tu banco y paga <strong>{formatBs(total)}</strong>.
        <small>QR de demostración: no lleva a ninguna cuenta real.</small>
      </figcaption>
    </figure>
  );
}

/**
 * "Ya pagué": el banco (simulado) confirma el pago y el pedido queda pagado al instante, sin
 * que nadie del equipo tenga que revisar nada.
 */
export function ConfirmarPagoQr({
  pedidoId,
  estado,
  alPagar,
}: {
  pedidoId: number;
  estado: PagoEstado;
  alPagar?: () => void;
}) {
  const [fase, setFase] = useState<"listo" | "verificando" | "pagado">("listo");
  const [error, setError] = useState("");

  if (fase === "pagado" || estado === "aprobado") {
    return (
      <p className="pago-aviso pago-aviso--ok" role="status">
        <strong>Pago confirmado por el banco.</strong> Tu pedido ya pasó a preparación.
      </p>
    );
  }
  if (estado !== "pendiente" && estado !== "por_verificar" && estado !== "rechazado") return null;

  const pagar = async () => {
    setError("");
    setFase("verificando");
    await new Promise((r) => window.setTimeout(r, 1500)); // el banco "avisa"
    const { error: e } = await supabase.rpc("pagar_qr", { p_pedido: pedidoId });
    if (e) {
      setFase("listo");
      return setError(/pagar_qr|schema cache/i.test(e.message) ? "Falta la migración 013 en Supabase." : mensajeDeError(e));
    }
    setFase("pagado");
    alPagar?.();
  };

  return (
    <div className="pago-subir">
      <button type="button" className="btn btn--primary" disabled={fase === "verificando"} onClick={pagar}>
        {fase === "verificando" ? "Verificando con el banco…" : "Ya pagué"}
      </button>
      <small className="pago-subir__ayuda">Cuando pagues desde tu banco, toca “Ya pagué”: el pago se confirma automáticamente (simulado).</small>
      {error && <p className="carrito__error" role="alert">{error}</p>}
    </div>
  );
}
