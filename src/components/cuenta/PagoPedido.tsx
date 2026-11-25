"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mensajeDeError, supabase } from "@/lib/supabase";
import { enlacePago } from "@/lib/pago-qr";
import { descargarQr } from "@/lib/descargar-qr";
import { formatBs } from "@/lib/utils";

/**
 * Pago por QR de un pedido o de un envío del Club. El cliente NO confirma nada: escanea el código
 * con su celular, la página /pagar avisa al sistema (como el aviso automático del banco en un
 * sistema real) y en esta pantalla, que está escuchando, el QR desaparece: "Verificando…" y luego
 * "¡Pago exitoso!".
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

/** La ruedita mientras el banco (simulado) responde. */
export function Verificando() {
  return (
    <div className="pago-verifica" role="status">
      <i aria-hidden="true" />
      <strong>Verificando…</strong>
      <span>Estamos confirmando tu pago</span>
    </div>
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

export const VERIFICANDO = 3000; // lo que gira la ruedita después de escanear
const VER_EXITO = 2600; // lo que se ve "¡Pago exitoso!" antes de avisar a quien nos usa
const CADA = 3000; // respaldo por si Realtime no avisa

export default function PagoQr({
  id,
  total,
  estado,
  destino = "pedido",
  alPagar,
  alVencer,
}: {
  /** Id del pedido, o del cobro cuando destino es "club". */
  id: number;
  total: number;
  estado: PagoEstado;
  destino?: "pedido" | "club";
  /** Se llama una vez, cuando ya se vio el "¡Pago exitoso!". */
  alPagar?: () => void;
  /** El pedido se canceló mientras se esperaba: pasaron los 30 minutos (migración 024). */
  alVencer?: () => void;
}) {
  const [token, setToken] = useState("");
  const [codigo, setCodigo] = useState("");
  const [bajando, setBajando] = useState<"" | "si" | "listo" | "error">("");
  const [fase, setFase] = useState<"qr" | "verificando" | "pagado" | "vencido">("qr");
  const [error, setError] = useState("");
  const avisado = useRef(false);
  const avisar = useRef(alPagar);
  const vencer = useRef(alVencer);
  useEffect(() => {
    avisar.current = alPagar;
    vencer.current = alVencer;
  });

  const tabla = destino === "club" ? "cobros_club" : "pedidos";
  const columna = destino === "club" ? "estado" : "pago_estado";
  const espera = fase === "qr" && (estado === "pendiente" || estado === "por_verificar" || estado === "rechazado");

  const exito = useCallback(() => {
    if (avisado.current) return;
    avisado.current = true;
    setFase("verificando");
    window.setTimeout(() => {
      setFase("pagado");
      window.setTimeout(() => avisar.current?.(), VER_EXITO);
    }, VERIFICANDO);
  }, []);

  useEffect(() => {
    if (!espera) return;
    let vivo = true;
    const revisar = async () => {
      const { data, error: e } = await supabase.from(tabla).select(destino === "club" ? `pago_token, ${columna}` : `pago_token, ${columna}, estado, codigo`).eq("id", id).maybeSingle();
      if (!vivo) return;
      if (e) return setError(/pago_token/i.test(e.message) ? "Falta la migración 021 en Supabase." : mensajeDeError(e));
      const fila = data as unknown as Record<string, string> | null;
      if (!fila) return;
      setError("");
      setToken(fila.pago_token);
      setCodigo(fila.codigo ?? "");
      if (fila[columna] === "aprobado") exito();
      else if (fila.estado === "cancelado") {
        setFase("vencido");
        vencer.current?.();
      }
    };
    const t = window.setTimeout(revisar, 0);
    const cada = window.setInterval(revisar, CADA);
    const volver = () => !document.hidden && revisar(); // al volver de la pestaña del pago
    document.addEventListener("visibilitychange", volver);
    // El mismo pedido puede estar a la vez en Mi cuenta y en el carrito: cada uno con su canal.
    const canal = supabase
      .channel(`pago-${tabla}-${id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: tabla, filter: `id=eq.${id}` }, (c) => (c.new as Record<string, unknown>)[columna] === "aprobado" && exito())
      .subscribe();
    return () => {
      vivo = false;
      window.clearTimeout(t);
      window.clearInterval(cada);
      document.removeEventListener("visibilitychange", volver);
      supabase.removeChannel(canal);
    };
  }, [espera, id, tabla, columna, destino, exito]);

  const bajar = async () => {
    setBajando("si");
    try {
      await descargarQr(enlacePago(token), total, destino === "club" ? "Club" : codigo || "Pedido");
      setBajando("listo");
    } catch {
      setBajando("error");
    }
  };

  if (fase === "verificando") return <Verificando />;
  if (fase === "pagado") return <PagoExitoso total={total} detalle={destino === "club" ? "tu envío quedó programado" : "tu pedido está confirmado"} />;
  if (fase === "vencido")
    return <p className="pago-aviso pago-aviso--rechazo" role="status"><strong>Este pedido se canceló.</strong> No se pagó a tiempo, así que su código ya no sirve. Puedes pedirlo otra vez.</p>;
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
      {/* Quien compra desde el celular no puede escanear su propia pantalla: baja la imagen. */}
      <div className="pago-qr__acciones">
        <button type="button" className="btn btn--secondary pago-qr__bajar" onClick={bajar} disabled={bajando === "si"}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 4v11m0 0 4.5-4.5M12 15l-4.5-4.5M5 19.5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {bajando === "si" ? "Preparando…" : "Descargar QR"}
        </button>
        <p className="pago-qr__ayuda" role="status">
          {bajando === "listo" ? "Listo: abre la imagen desde tu app y escanéala. Esta pantalla se actualiza sola." : bajando === "error" ? "No se pudo descargar. Hazle una captura a la pantalla." : "¿No tienes otro celular? Descárgalo y ábrelo desde tu galería."}
        </p>
      </div>
    </>
  );
}
