"use client";

import { useEffect, useRef, useState } from "react";
import { formatBs } from "@/lib/utils";
import { QrPago } from "@/components/cuenta/PagoPedido";

/**
 * Cobro por QR o con tarjeta en la Caja, SIMULADO (como en la tienda en línea): no hay banco ni
 * pasarela de verdad, pero el flujo es el mismo que vería el cajero en un local real.
 *
 *  · QR: se muestra el código con el monto; el cliente "paga" desde la app de su banco y el
 *    cajero confirma con "Simular pago recibido". Recién ahí se registra la venta.
 *  · Tarjeta: el cajero (o el cliente) escribe los datos de la tarjeta, se validan como lo haría
 *    una pasarela (número con el algoritmo de Luhn, vencimiento, CVV) y se "consulta al banco".
 *    Con la tarjeta de prueba terminada en 0002 el banco la rechaza, para mostrar ese caso.
 *
 * Los datos de la tarjeta NO se guardan en ningún lado: viven en el estado del diálogo y se
 * borran al cerrarlo. La venta solo registra el método ("tarjeta"), igual que antes.
 */

type Fase = "datos" | "procesando" | "aprobado" | "rechazado";

const espera = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

/** Algoritmo de Luhn: el dígito verificador que traen todas las tarjetas reales. */
function luhnValido(numero: string) {
  let suma = 0;
  let doble = false;
  for (let i = numero.length - 1; i >= 0; i--) {
    let d = Number(numero[i]);
    if (doble) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    suma += d;
    doble = !doble;
  }
  return numero.length >= 13 && suma % 10 === 0;
}

const marcaDe = (n: string) => (/^4/.test(n) ? "Visa" : /^5[1-5]|^2[2-7]/.test(n) ? "Mastercard" : /^3[47]/.test(n) ? "American Express" : "");
const agrupar = (n: string) => n.replace(/(\d{4})(?=\d)/g, "$1 ");

export default function CobroSimulado({
  metodo,
  total,
  alConfirmar,
  alCerrar,
}: {
  metodo: "qr" | "tarjeta";
  total: number;
  /** Registra la venta; devuelve false si la base la rechazó (el error lo muestra la Caja). */
  alConfirmar: () => Promise<boolean>;
  alCerrar: () => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [fase, setFase] = useState<Fase>("datos");
  const [referencia] = useState(() => `CAJA-${new Date().toTimeString().slice(0, 8).replace(/:/g, "")}`);
  const [numero, setNumero] = useState("");
  const [nombre, setNombre] = useState("");
  const [vence, setVence] = useState("");
  const [cvv, setCvv] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    dialogo.current?.showModal();
  }, []);

  const ocupado = fase === "procesando";
  const cerrar = () => !ocupado && dialogo.current?.close();

  /** Después de "aprobar" el pago, se registra la venta y se cierra. */
  const aprobar = async () => {
    const ok = await alConfirmar();
    if (!ok) return dialogo.current?.close();
    setFase("aprobado");
    await espera(1100);
    dialogo.current?.close();
  };

  const pagarQr = async () => {
    setFase("procesando");
    await espera(1200); // "llega" la notificación del banco
    await aprobar();
  };

  const pagarTarjeta = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const [mm, aa] = vence.split("/").map(Number);
    const hoy = new Date();
    const finDeMes = new Date(2000 + (aa || 0), mm || 0, 1);
    if (!luhnValido(numero)) return setError("El número de tarjeta no es válido. Revisa los 16 dígitos.");
    if (!nombre.trim()) return setError("Escribe el nombre como figura en la tarjeta.");
    if (!(mm >= 1 && mm <= 12) || !aa) return setError("El vencimiento va así: MM/AA.");
    if (finDeMes <= hoy) return setError("La tarjeta está vencida.");
    if (!/^\d{3,4}$/.test(cvv)) return setError("El CVV son los 3 dígitos del reverso.");
    setFase("procesando");
    await espera(1600); // "consulta al banco"
    if (numero.endsWith("0002")) {
      setFase("rechazado");
      return;
    }
    await aprobar();
  };

  const marca = marcaDe(numero);

  return (
    <dialog
      ref={dialogo}
      className="dialogo cobro"
      aria-labelledby="cobro-titulo"
      onClose={alCerrar}
      onCancel={(e) => ocupado && e.preventDefault()}
    >
      <div className="dialogo__cabeza">
        <div>
          <h2 id="cobro-titulo">{metodo === "qr" ? "Cobro con QR" : "Cobro con tarjeta"}</h2>
          <p className="caja__sub">Total a cobrar: <strong>{formatBs(total)}</strong></p>
        </div>
        <button type="button" className="carrito__cerrar" aria-label="Cerrar" onClick={cerrar} disabled={ocupado}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      {fase === "aprobado" ? (
        <div className="cobro__resultado cobro__resultado--ok" role="status">
          <span className="cobro__check" aria-hidden="true">✓</span>
          <strong>Pago aprobado</strong>
          <span>{formatBs(total)} · venta registrada</span>
        </div>
      ) : metodo === "qr" ? (
        <div className="cobro__cuerpo">
          <QrPago codigo={referencia} total={total} />
          <p className="caja__sub">Muestra este código al cliente. Cuando su banco confirme el pago, regístralo.</p>
          <div className="entrega__acciones">
            <button type="button" className="btn btn--primary" onClick={pagarQr} disabled={ocupado}>
              {ocupado ? "Esperando al banco…" : "Simular pago recibido"}
            </button>
            <button type="button" className="btn btn--secondary" onClick={cerrar} disabled={ocupado}>Cancelar</button>
          </div>
        </div>
      ) : fase === "rechazado" ? (
        <div className="cobro__cuerpo">
          <div className="cobro__resultado cobro__resultado--mal" role="alert">
            <span className="cobro__check" aria-hidden="true">✕</span>
            <strong>Tarjeta rechazada</strong>
            <span>El banco no autorizó el pago. Prueba con otra tarjeta u otro método.</span>
          </div>
          <div className="entrega__acciones">
            <button type="button" className="btn btn--primary" onClick={() => { setFase("datos"); setNumero(""); setCvv(""); }}>Probar otra tarjeta</button>
            <button type="button" className="btn btn--secondary" onClick={cerrar}>Cancelar</button>
          </div>
        </div>
      ) : (
        <form className="cobro__cuerpo" onSubmit={pagarTarjeta} noValidate>
          {/* Vista previa de la tarjeta mientras se escribe. */}
          <div className="tarjeta-sim" aria-hidden="true">
            <span className="tarjeta-sim__chip" />
            <span className="tarjeta-sim__marca">{marca || "Tarjeta"}</span>
            <span className="tarjeta-sim__numero">{agrupar(numero.padEnd(16, "•"))}</span>
            <span className="tarjeta-sim__pie">
              <span>{nombre.trim().toUpperCase() || "NOMBRE APELLIDO"}</span>
              <span>{vence || "MM/AA"}</span>
            </span>
          </div>

          <div className="carrito__campo">
            <label htmlFor="t-numero">Número de tarjeta</label>
            <input
              id="t-numero"
              inputMode="numeric"
              autoComplete="off"
              placeholder="4242 4242 4242 4242"
              value={agrupar(numero)}
              onChange={(e) => setNumero(e.target.value.replace(/\D/g, "").slice(0, 16))}
              disabled={ocupado}
            />
          </div>
          <div className="carrito__campo">
            <label htmlFor="t-nombre">Nombre en la tarjeta</label>
            <input id="t-nombre" autoComplete="off" value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={ocupado} />
          </div>
          <div className="cobro__fila">
            <div className="carrito__campo">
              <label htmlFor="t-vence">Vence</label>
              <input
                id="t-vence"
                inputMode="numeric"
                autoComplete="off"
                placeholder="MM/AA"
                value={vence}
                onChange={(e) => {
                  const d = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setVence(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
                }}
                disabled={ocupado}
              />
            </div>
            <div className="carrito__campo">
              <label htmlFor="t-cvv">CVV</label>
              <input
                id="t-cvv"
                inputMode="numeric"
                autoComplete="off"
                type="password"
                placeholder="123"
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                disabled={ocupado}
              />
            </div>
          </div>

          {error && <p className="carrito__error" role="alert">{error}</p>}
          <p className="cobro__aviso">
            Simulación: no se cobra ni se guarda nada. Tarjeta de prueba <strong>4242 4242 4242 4242</strong> (aprobada) o{" "}
            <strong>4000 0000 0000 0002</strong> (rechazada), con cualquier vencimiento futuro y CVV.
          </p>
          <div className="entrega__acciones">
            <button type="submit" className="btn btn--primary" disabled={ocupado}>
              {ocupado ? "Consultando al banco…" : `Pagar ${formatBs(total)}`}
            </button>
            <button type="button" className="btn btn--secondary" onClick={cerrar} disabled={ocupado}>Cancelar</button>
          </div>
        </form>
      )}
    </dialog>
  );
}
