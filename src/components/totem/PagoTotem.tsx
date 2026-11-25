"use client";

import { formatBs } from "@/lib/utils";
import QrTotem from "./QrTotem";

/** Se elige QR o tarjeta. Tarjeta: lector simulado → PIN → "banco" → aprobado o rechazado. */
export type EstadoPago = "elegir" | "qr" | "verificando" | "insertar" | "leyendo" | "pin" | "procesando" | "rechazado";

export default function PagoTotem({
  pago,
  pin,
  total,
  error,
  alElegir,
  alEscanear,
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
  alElegir: (metodo: "qr" | "tarjeta") => void;
  /** El celular avisó que pagó. */
  alEscanear: () => void;
  alInsertar: () => void;
  alTeclear: (d: string) => void;
  alBorrar: () => void;
  alConfirmar: () => void;
  alReintentar: () => void;
}) {
  return (
    <section className="totem__pago" aria-live="polite">
      <p className="totem__pago-total">Total a pagar <strong>{formatBs(total)}</strong></p>

      {pago === "elegir" ? (
        <>
          <h1>¿Cómo quieres pagar?</h1>
          <div className="totem__metodos">
            <button type="button" onClick={() => alElegir("qr")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5zM20 14v1.5M14 20h1.5" />
              </svg>
              <strong>QR</strong>
              <span>Escanéalo con tu celular</span>
            </button>
            <button type="button" onClick={() => alElegir("tarjeta")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <rect x="2.5" y="5" width="19" height="14" rx="2.4" />
                <path d="M2.5 9.5h19M6 15h4" />
              </svg>
              <strong>Tarjeta</strong>
              <span>Débito, con tu PIN</span>
            </button>
          </div>
          {error && <p className="totem__error" role="alert">{error}</p>}
        </>
      ) : pago === "qr" ? (
        <QrTotem total={total} alPagar={alEscanear} />
      ) : pago === "verificando" ? (
        <div className="totem__procesando">
          <span className="totem__spinner" aria-hidden="true" />
          <h1>Verificando…</h1>
          <p className="totem__ayuda">Estamos confirmando tu pago</p>
        </div>
      ) : pago === "insertar" || pago === "leyendo" ? (
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
