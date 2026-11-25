"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { avisarCaja } from "@/lib/pago-qr";
import { PagoExitoso, VERIFICANDO } from "@/components/cuenta/PagoPedido";
import { formatBs } from "@/lib/utils";

/**
 * Lo que abre el celular al escanear el QR (migración 021). No hay nada que tocar: la página avisa
 * al sistema que el pago se hizo y las dos pantallas, esta y la de la compra, muestran a la vez
 * "Verificando…" y después "¡Pago exitoso!".
 *
 * En un sistema real este aviso lo manda el banco; aquí lo manda el celular, como simulación.
 */

type Estado =
  | { fase: "conectando"; monto?: number }
  | { fase: "listo"; monto: number; concepto: string; repetido: boolean }
  | { fase: "error"; mensaje: string };

const UUID = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export default function PaginaPagar() {
  const [estado, setEstado] = useState<Estado>({ fase: "conectando" });
  const [intento, setIntento] = useState(0);
  const corrido = useRef(-1);

  useEffect(() => {
    const rueda = () => new Promise((r) => window.setTimeout(r, VERIFICANDO));
    if (corrido.current === intento) return; // en desarrollo React monta dos veces: se paga una
    corrido.current = intento;
    const q = new URLSearchParams(window.location.search);
    const token = q.get("t") ?? "";
    const caja = q.get("c") ?? "";
    const monto = Number(q.get("m")) || 0;

    window.setTimeout(async () => {
      if (UUID.test(token)) {
        const { data, error } = await supabase.rpc("pagar_con_qr", { p_token: token });
        if (error) {
          const red = /fetch|network/i.test(error.message);
          return setEstado({ fase: "error", mensaje: red ? "No hay internet en este celular. Conéctate e intenta otra vez." : /pagar_con_qr/i.test(error.message) ? "Falta la migración 021 en Supabase." : error.message });
        }
        if (!data.repetido) await rueda();
        return setEstado({ fase: "listo", monto: Number(data.total), concepto: data.concepto, repetido: !!data.repetido });
      }
      if (UUID.test(caja)) {
        if (await avisarCaja(caja)) {
          await rueda();
          return setEstado({ fase: "listo", monto, concepto: "Compra en la cafetería", repetido: false });
        }
        return setEstado({ fase: "error", mensaje: "No pudimos avisar a la caja. Revisa tu internet e intenta otra vez." });
      }
      setEstado({ fase: "error", mensaje: "Este código de pago no es válido." });
    }, 300);
  }, [intento]);

  return (
    <>
      <p className="pagar__marca">Grano y Aroma</p>
      {estado.fase === "conectando" && (
        <>
          <i className="pagar__gira" aria-hidden="true" />
          <h1 role="status">Verificando…</h1>
        </>
      )}
      {estado.fase === "listo" && (
        <>
          {estado.repetido ? (
            <>
              <h1>Este pago ya se hizo</h1>
              <p className="pagar__monto">{formatBs(estado.monto)}</p>
            </>
          ) : (
            <PagoExitoso total={estado.monto} />
          )}
          <p className="pagar__concepto">{estado.concepto}</p>
          <p className="pagar__pie">Ya puedes cerrar esta página: la pantalla de tu compra se actualiza sola.</p>
        </>
      )}
      {estado.fase === "error" && (
        <>
          <h1 role="alert">No se pudo pagar</h1>
          <p className="pagar__concepto">{estado.mensaje}</p>
          <button type="button" className="btn btn--primary" onClick={() => { setEstado({ fase: "conectando" }); setIntento((n) => n + 1); }}>
            Intentar otra vez
          </button>
        </>
      )}
      <p className="pagar__pie">Pago de demostración: no se mueve dinero real.</p>
    </>
  );
}
