"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mensajeDeError, supabase } from "@/lib/supabase";
import { enlacePago } from "@/lib/pago-qr";
import { formatBs } from "@/lib/utils";

/**
 * Pago por QR de un pedido o de un envío del Club. El cliente NO confirma nada: escanea el código
 * con su celular, la página /pagar avisa al sistema (como el aviso automático del banco en un
 * sistema real) y esta pantalla, que está escuchando, pasa sola a "¡Pago exitoso!".
 *
 * Se usa al confirmar la compra (carrito), en Mi cuenta mientras el pago esté pendiente y en la
 * suscripción del Club. Es una simulación: no se mueve dinero (migración 021).
 */

export type PagoEstado = "no_aplica" | "pendiente" | "por_verificar" | "aprobado" | "rechazado";

export const TEXTO_PAGO: Record<PagoEstado, string> = {
  no_aplica: "",
  pendiente: "Esperando el pago",
  por_verificar: "Verificando el pago",
  aprobado: "Pago aprobado",
  rechazado: "Pago rechazado",
};

/** El QR con un enlace de pago. Sirve también para la Caja. */
export function QrPago({ enlace, total }: { enlace: string; total: number }) {
  const [svg, setSvg] = useState("");

  useEffect(() => {
    let vivo = true;
    import("qrcode").then((qr) =>
      qr
        .toString(enlace, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#2a1f1a", light: "#ffffff" } })
        .then((s) => vivo && setSvg(s)),
    );
    return () => {
      vivo = false;
    };
  }, [enlace]);

  return (
    <figure className="pago-qr">
      <div className="pago-qr__codigo" role="img" aria-label={`Código QR para pagar ${formatBs(total)}`} dangerouslySetInnerHTML={{ __html: svg }} />
      <figcaption>
        Escanéalo con la cámara de tu celular para pagar <strong>{formatBs(total)}</strong>.
        <small>QR de demostración: no se mueve dinero real.</small>
        <span className="pago-qr__espera" role="status">
          <i aria-hidden="true" /> Esperando el pago…
        </span>
      </figcaption>
    </figure>
  );
}

/** El resultado, igual para QR y tarjeta. */
export function PagoExitoso({ total, detalle }: { total: number; detalle?: string }) {
  return (
    <div className="pago-exito" role="status">
      <svg className="pago-exito__check" viewBox="0 0 72 72" aria-hidden="true">
        <circle cx="36" cy="36" r="33" />
        <path d="M22 37.5l9.5 9.5L51 27" />
      </svg>
      <strong>¡Pago exitoso!</strong>
      <span>{formatBs(total)}{detalle && ` · ${detalle}`}</span>
    </div>
  );
}

const VER_EXITO = 2600; // lo que se ve "¡Pago exitoso!" antes de avisar a quien nos usa
const CADA = 3000; // respaldo por si Realtime no avisa

export default function PagoQr({
  id,
  total,
  estado,
  destino = "pedido",
  alPagar,
}: {
  /** Id del pedido, o del cobro cuando destino es "club". */
  id: number;
  total: number;
  estado: PagoEstado;
  destino?: "pedido" | "club";
  /** Se llama una vez, cuando ya se vio el "¡Pago exitoso!". */
  alPagar?: () => void;
}) {
  const [token, setToken] = useState("");
  const [pagado, setPagado] = useState(false);
  const [error, setError] = useState("");
  const avisado = useRef(false);
  const avisar = useRef(alPagar);
  useEffect(() => {
    avisar.current = alPagar;
  });

  const tabla = destino === "club" ? "cobros_club" : "pedidos";
  const columna = destino === "club" ? "estado" : "pago_estado";
  const espera = !pagado && (estado === "pendiente" || estado === "por_verificar" || estado === "rechazado");

  const exito = useCallback(() => {
    if (avisado.current) return;
    avisado.current = true;
    setPagado(true);
    window.setTimeout(() => avisar.current?.(), VER_EXITO);
  }, []);

  useEffect(() => {
    if (!espera) return;
    let vivo = true;
    const revisar = async () => {
      const { data, error: e } = await supabase.from(tabla).select(`pago_token, ${columna}`).eq("id", id).maybeSingle();
      if (!vivo) return;
      if (e) return setError(/pago_token/i.test(e.message) ? "Falta la migración 021 en Supabase." : mensajeDeError(e));
      const fila = data as unknown as Record<string, string> | null;
      if (!fila) return;
      setError("");
      setToken(fila.pago_token);
      if (fila[columna] === "aprobado") exito();
    };
    const t = window.setTimeout(revisar, 0);
    const cada = window.setInterval(revisar, CADA);
    const volver = () => !document.hidden && revisar(); // al volver de la pestaña del pago
    document.addEventListener("visibilitychange", volver);
    const canal = supabase
      .channel(`pago-${tabla}-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: tabla, filter: `id=eq.${id}` }, (c) => (c.new as Record<string, unknown>)[columna] === "aprobado" && exito())
      .subscribe();
    return () => {
      vivo = false;
      window.clearTimeout(t);
      window.clearInterval(cada);
      document.removeEventListener("visibilitychange", volver);
      supabase.removeChannel(canal);
    };
  }, [espera, id, tabla, columna, exito]);

  if (pagado) return <PagoExitoso total={total} detalle={destino === "club" ? "tu envío quedó programado" : "tu pedido está confirmado"} />;
  if (estado === "aprobado")
    return (
      <p className="pago-aviso pago-aviso--ok" role="status">
        <strong>Pago confirmado por el banco.</strong> {destino === "club" ? "Tu envío quedó programado." : "Tu pedido está confirmado."}
      </p>
    );
  if (!espera) return null;
  if (error) return <p className="carrito__error" role="alert">{error}</p>;
  if (!token) return <p aria-busy="true">Generando tu código…</p>;

  return (
    <>
      <QrPago enlace={enlacePago(token)} total={total} />
      {/* Quien compra desde el celular no puede escanear su propia pantalla. */}
      <a className="btn btn--primary pago-qr__celular" href={enlacePago(token)} target="_blank" rel="noopener">
        Pagar {formatBs(total)} desde este celular
      </a>
    </>
  );
}
