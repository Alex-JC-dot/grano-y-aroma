"use client";

import { useEffect, useRef, useState } from "react";
import { formatBs } from "@/lib/utils";
import { PagoExitoso, QrPago, Verificando, VERIFICANDO } from "@/components/cuenta/PagoPedido";
import { enlaceCaja, esperarAvisoCaja } from "@/lib/pago-qr";
import FormTarjeta, { TARJETA_VACIA, consultarBanco, validarTarjeta, type DatosTarjeta } from "@/components/ui/TarjetaSimulada";

/**
 * Cobro por QR o con tarjeta en la Caja, SIMULADO (como en la tienda en línea): no hay banco ni
 * pasarela de verdad, pero el flujo es el mismo que vería el cajero en un local real.
 *
 *  · QR: el cliente escanea el código con su celular; el aviso llega solo a la Caja (Realtime) y
 *    recién ahí se registra la venta. El cajero no confirma nada.
 *  · Tarjeta: el formulario compartido con la tienda (TarjetaSimulada) valida los datos y
 *    "consulta al banco"; con la tarjeta de prueba terminada en 0002 el banco la rechaza.
 */

type Fase = "datos" | "procesando" | "aprobado" | "rechazado";

export default function CobroSimulado({
  metodo,
  total: totalActual,
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
  // Al registrar la venta la orden se vacía: el monto se guarda para mostrarlo en el resultado.
  const [total] = useState(totalActual);
  const [codigo] = useState(() => crypto.randomUUID());
  const [enlace, setEnlace] = useState("");
  const [tarjeta, setTarjeta] = useState<DatosTarjeta>(TARJETA_VACIA);
  const [error, setError] = useState("");

  useEffect(() => {
    dialogo.current?.showModal();
  }, []);

  const ocupado = fase === "procesando";
  const cerrar = () => !ocupado && dialogo.current?.close();

  /** Con el pago aprobado se registra la venta y se cierra. */
  const aprobar = async () => {
    const ok = await alConfirmar();
    if (!ok) return dialogo.current?.close();
    setFase("aprobado");
    await new Promise((r) => window.setTimeout(r, 2000));
    dialogo.current?.close();
  };

  // QR: se espera el aviso del celular. Solo cuenta el primero.
  const alAviso = useRef<() => void>(() => {});
  useEffect(() => {
    alAviso.current = async () => {
      if (fase !== "datos") return;
      alAviso.current = () => {};
      setFase("procesando");
      await new Promise((r) => window.setTimeout(r, VERIFICANDO));
      aprobar();
    };
  });
  useEffect(() => {
    if (metodo !== "qr") return;
    const t = window.setTimeout(() => setEnlace(enlaceCaja(codigo, total)), 0);
    const dejar = esperarAvisoCaja(codigo, () => alAviso.current());
    return () => {
      window.clearTimeout(t);
      dejar();
    };
  }, [metodo, codigo, total]);

  const pagarTarjeta = async (e: React.FormEvent) => {
    e.preventDefault();
    const problema = validarTarjeta(tarjeta);
    setError(problema ?? "");
    if (problema) return;
    setFase("procesando");
    if (!(await consultarBanco(tarjeta))) return setFase("rechazado");
    await aprobar();
  };

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
        <PagoExitoso total={total} detalle="venta registrada" />
      ) : metodo === "qr" ? (
        <div className="cobro__cuerpo">
          {ocupado ? (
            <Verificando />
          ) : (
            <>
              {enlace && <QrPago enlace={enlace} total={total} />}
              <p className="caja__sub">Muestra este código al cliente: cuando lo escanee, la venta se registra sola.</p>
            </>
          )}
          <div className="entrega__acciones">
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
            <button type="button" className="btn btn--primary" onClick={() => { setFase("datos"); setTarjeta((t) => ({ ...t, numero: "", cvv: "" })); }}>
              Probar otra tarjeta
            </button>
            <button type="button" className="btn btn--secondary" onClick={cerrar}>Cancelar</button>
          </div>
        </div>
      ) : (
        <form className="cobro__cuerpo" onSubmit={pagarTarjeta} noValidate>
          <FormTarjeta datos={tarjeta} alCambiar={setTarjeta} deshabilitado={ocupado} prefijo="caja-t" />
          {error && <p className="carrito__error" role="alert">{error}</p>}
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
