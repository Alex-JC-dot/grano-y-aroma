"use client";

import { formatBs } from "@/lib/utils";

/** Pago con tarjeta de débito: lector simulado → PIN → "banco" → aprobado o rechazado. */
export type EstadoPago = "insertar" | "leyendo" | "pin" | "procesando" | "rechazado";

export default function PagoTotem({
  pago,
  pin,
  total,
  error,
  alInsertar,
  alTeclear,
  alBorrar,
  alConfirmar,
  alReintentar,
}: {
  pago: EstadoPago;
  pin: string;
  total: number;
  error: string;
  alInsertar: () => void;
  alTeclear: (d: string) => void;
  alBorrar: () => void;
  alConfirmar: () => void;
  alReintentar: () => void;
}) {
  return (
    <section className="totem__pago" aria-live="polite">
      <p className="totem__pago-total">Total a pagar <strong>{formatBs(total)}</strong></p>

      {pago === "insertar" || pago === "leyendo" ? (
        <>
          <h1>{pago === "leyendo" ? "Leyendo tarjeta…" : "Inserta o acerca tu tarjeta de débito"}</h1>
          {/* El lector simulado: tocar la tarjeta equivale a insertarla en el lector real. */}
          <button type="button" className={`lector${pago === "leyendo" ? " is-leyendo" : ""}`} onClick={alInsertar} disabled={pago === "leyendo"} aria-label="Insertar tarjeta">
            <span className="lector__ranura" aria-hidden="true" />
            <span className="lector__tarjeta" aria-hidden="true">
              <span className="tarjeta-sim__chip" />
              <span>DÉBITO</span>
            </span>
            <span className="lector__ondas" aria-hidden="true" />
          </button>
          <p className="totem__ayuda">Toca la tarjeta para simular el lector</p>
          {error && <p className="totem__error" role="alert">{error}</p>}
        </>
      ) : pago === "pin" ? (
        <>
          <h1>Ingresa tu PIN</h1>
          <p className="totem__pin" aria-label={`${pin.length} de 4 dígitos`}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={i < pin.length ? "is-on" : ""} />
            ))}
          </p>
          <div className="teclado">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button key={d} type="button" onClick={() => alTeclear(d)}>{d}</button>
            ))}
            <button type="button" className="teclado__borrar" onClick={alBorrar} aria-label="Borrar">⌫</button>
            <button type="button" onClick={() => alTeclear("0")}>0</button>
            <button type="button" className="teclado__ok" onClick={alConfirmar} disabled={pin.length < 4}>OK</button>
          </div>
          <p className="totem__ayuda">Simulación: cualquier PIN de 4 dígitos se aprueba; 0000 se rechaza.</p>
        </>
      ) : pago === "procesando" ? (
        <div className="totem__procesando">
          <span className="totem__spinner" aria-hidden="true" />
          <h1>Procesando con el banco…</h1>
          <p className="totem__ayuda">No retires la tarjeta</p>
        </div>
      ) : (
        <div className="cobro__resultado cobro__resultado--mal" role="alert">
          <span className="cobro__check" aria-hidden="true">✕</span>
          <strong>Pago rechazado</strong>
          <span>El banco no autorizó el pago (PIN incorrecto). Intenta de nuevo.</span>
          <button type="button" className="tprincipal" onClick={alReintentar}>Intentar de nuevo</button>
        </div>
      )}
    </section>
  );
}
