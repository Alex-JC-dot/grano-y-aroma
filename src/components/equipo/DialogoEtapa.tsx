"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mensajeDeError, supabase } from "@/lib/supabase";

/**
 * Las dos etapas intermedias del pedido: empezar a prepararlo y despacharlo.
 *
 * Antes eran un botón que solo cambiaba una palabra en la pantalla. El docente señaló
 * exactamente eso: un sistema real no dice "En preparación" sin decir quién lo prepara, ni
 * "En camino" sin decir quién lo lleva. Ahora cada etapa pide su dato y la base lo exige
 * (migración 011), así que el pedido no avanza sin esa información.
 *
 *  · Preparación: queda registrado quién lo arma, con una nota opcional para el resto del
 *    equipo ("falta una bolsa de Villa Serrano, va cuando llegue el tueste").
 *  · Despacho: se elige el repartidor de la lista de gente activa. No se escribe a mano,
 *    porque escribiéndolo el mismo repartidor terminaba cargado de tres formas distintas y
 *    era imposible saber cuántos pedidos llevaba cada uno.
 */

type Repartidor = { id: number; nombre: string; telefono: string | null; vehiculo: string | null };

export default function DialogoEtapa({
  etapa,
  pedidoId,
  codigo,
  alTerminar,
  alCerrar,
}: {
  etapa: "preparacion" | "despacho";
  pedidoId: number;
  codigo: string;
  alTerminar: () => void;
  alCerrar: () => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [nota, setNota] = useState("");
  const [repartidores, setRepartidores] = useState<Repartidor[] | null>(null);
  const [elegido, setElegido] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const esDespacho = etapa === "despacho";

  const cargarRepartidores = useCallback(async () => {
    const { data, error: e } = await supabase
      .from("repartidores")
      .select("id, nombre, telefono, vehiculo")
      .eq("activo", true)
      .order("nombre");
    if (e) {
      setError(
        /does not exist|schema cache/i.test(e.message)
          ? "Falta la tabla de repartidores: corre la migración 011 en Supabase."
          : mensajeDeError(e),
      );
      setRepartidores([]);
      return;
    }
    const lista = (data as Repartidor[]) ?? [];
    setRepartidores(lista);
    // Con un solo repartidor activo no tiene sentido obligar a elegirlo.
    if (lista.length === 1) setElegido(lista[0].id);
  }, []);

  useEffect(() => {
    dialogo.current?.showModal();
    // La carga se difiere un tick, igual que en el resto de los paneles: así el estado no se
    // toca dentro del cuerpo del efecto, que es lo que React desaconseja.
    if (!esDespacho) return;
    const t = window.setTimeout(cargarRepartidores, 0);
    return () => window.clearTimeout(t);
  }, [esDespacho, cargarRepartidores]);

  const confirmar = async () => {
    if (esDespacho && !elegido) return setError("Elige qué repartidor lleva el pedido.");
    setGuardando(true);
    setError("");
    try {
      const { error: e } = esDespacho
        ? await supabase.rpc("registrar_despacho", { p_pedido: pedidoId, p_repartidor: elegido })
        : await supabase.rpc("registrar_preparacion", { p_pedido: pedidoId, p_nota: nota.trim() || null });
      if (e) throw e;
      alTerminar();
      dialogo.current?.close();
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <dialog ref={dialogo} className="dialogo entrega" onClose={alCerrar} onCancel={alCerrar}>
      <div className="dialogo__cabeza">
        <div>
          <h2>{esDespacho ? "Despachar pedido" : "Empezar a preparar"}</h2>
          <p className="caja__sub">Pedido {codigo}</p>
        </div>
        <button type="button" className="carrito__cerrar" aria-label="Cerrar" onClick={() => dialogo.current?.close()}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </button>
      </div>

      <div className="entrega__cuerpo">
        {esDespacho ? (
          <section className="entrega__bloque">
            <h3>Quién lo lleva</h3>
            <p className="caja__sub">El cliente verá su nombre en el seguimiento del pedido.</p>

            {repartidores === null ? (
              <p className="caja__vacia" aria-busy="true">Cargando repartidores…</p>
            ) : repartidores.length === 0 ? (
              <p className="caja__vacia">
                No hay repartidores activos. El administrador los carga desde Usuarios → Repartidores.
              </p>
            ) : (
              <fieldset className="entrega__quien">
                <legend className="sr-only">Repartidores disponibles</legend>
                {repartidores.map((r) => (
                  <label key={r.id} className={`entrega__opcion${elegido === r.id ? " is-on" : ""}`}>
                    <input
                      type="radio"
                      name="repartidor"
                      value={r.id}
                      checked={elegido === r.id}
                      onChange={() => setElegido(r.id)}
                      disabled={guardando}
                    />
                    <span>
                      <strong>{r.nombre}</strong>
                      <small>
                        {[r.vehiculo, r.telefono].filter(Boolean).join(" · ") || "Sin datos de contacto"}
                      </small>
                    </span>
                  </label>
                ))}
              </fieldset>
            )}
          </section>
        ) : (
          <section className="entrega__bloque">
            <h3>Nota para el equipo</h3>
            <p className="caja__sub">Opcional. Queda guardada con el pedido y la ve quien lo despache.</p>
            <div className="carrito__campo">
              <label htmlFor="etapa-nota">Nota</label>
              <input
                id="etapa-nota"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Falta una bolsa de Villa Serrano, sale con el tueste de mañana"
                disabled={guardando}
              />
            </div>
            <p className="caja__sub">Se registrará que lo preparaste tú, con la hora.</p>
          </section>
        )}

        {error && <p className="carrito__error" role="alert">{error}</p>}
      </div>

      <div className="entrega__acciones">
        <button
          type="button"
          className="btn btn--primary"
          disabled={guardando || (esDespacho && !elegido)}
          onClick={confirmar}
        >
          {guardando ? "Guardando…" : esDespacho ? "Despachar" : "Empezar a preparar"}
        </button>
        <button type="button" className="btn btn--secondary" disabled={guardando} onClick={() => dialogo.current?.close()}>
          Cancelar
        </button>
      </div>
    </dialog>
  );
}
