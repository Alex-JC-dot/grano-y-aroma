"use client";

import { useEffect, useRef, useState } from "react";
import { enlaceCaja, esperarAvisoCaja } from "@/lib/pago-qr";

/**
 * Pago con QR en el tótem: el mismo mecanismo que la Caja. El cliente escanea el código con su
 * celular, el aviso llega solo (Realtime) y recién ahí se crea el pedido. Nadie toca nada más.
 */
export default function QrTotem({ total, alPagar }: { total: number; alPagar: () => void }) {
  const [codigo] = useState(() => crypto.randomUUID());
  const [svg, setSvg] = useState("");
  const avisar = useRef(alPagar);
  useEffect(() => {
    avisar.current = alPagar;
  });

  useEffect(() => {
    let vivo = true;
    let hecho = false;
    import("qrcode")
      .then((qr) => qr.toString(enlaceCaja(codigo, total), { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#2a1f1a", light: "#ffffff" } }))
      .then((s) => vivo && setSvg(s));
    const dejar = esperarAvisoCaja(codigo, () => {
      if (hecho) return; // escanear dos veces no paga dos veces
      hecho = true;
      avisar.current();
    });
    return () => {
      vivo = false;
      dejar();
    };
  }, [codigo, total]);

  return (
    <>
      <h1>Escanea el QR con tu celular</h1>
      <div className="totem__qr" role="img" aria-label="Código QR para pagar" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="totem__qr-espera" role="status"><i aria-hidden="true" /> Esperando el pago…</p>
      <p className="totem__ayuda">Se confirma solo. QR de demostración: no se mueve dinero real.</p>
    </>
  );
}
