"use client";
/* eslint-disable @next/next/no-img-element -- export estático: next/image no optimiza aquí */

import { useEffect, useRef, useState } from "react";
import { subirEntrega, subirFirma } from "@/lib/archivos";
import { mensajeDeError, supabase } from "@/lib/supabase";
import FirmaRecuadro from "./Firma";

/**
 * Cierre de una entrega con su prueba.
 *
 * Hasta ahora marcar "Entregado" era un botón y nada más: si el cliente decía que su pedido
 * nunca llegó, el sistema no tenía con qué responder. Este diálogo pide lo que pide
 * cualquier empresa de reparto: una foto de dónde quedó el paquete y el nombre de quien lo
 * recibió. La base de datos exige ambas cosas (ver migración 010), así que no es un formulario
 * que se pueda saltar: sin evidencia el pedido no se cierra.
 *
 * En celular, `capture="environment"` abre la cámara trasera directamente en vez del
 * explorador de archivos. El repartidor está parado en la puerta con una mano ocupada: cada
 * toque de menos cuenta.
 *
 * La foto se sube primero y el estado se cambia después, dentro de registrar_entrega(). Si la
 * subida falla, el pedido sigue "en camino" y se puede reintentar; nunca queda un pedido
 * entregado apuntando a una foto que no llegó.
 *
 * La firma es opcional a propósito: no siempre hay quien firme —se deja en portería, el
 * cliente está apurado— y bloquear la entrega por eso dejaría pedidos abiertos para siempre.
 * Lo obligatorio es la foto y el nombre.
 */

const QUIEN: { v: string; label: string; ayuda: string }[] = [
  { v: "titular", label: "La persona que pidió", ayuda: "Recibió quien hizo el pedido." },
  { v: "familiar", label: "Un familiar", ayuda: "Alguien de la casa." },
  { v: "portero", label: "Portería o recepción", ayuda: "Edificio, oficina o conserje." },
  { v: "vecino", label: "Un vecino", ayuda: "Quedó con alguien de al lado." },
  { v: "otro", label: "Otra persona", ayuda: "Explica abajo quién recibió." },
];

export default function DialogoEntrega({
  pedidoId,
  codigo,
  clienteId,
  nombreCliente,
  alTerminar,
  alCerrar,
}: {
  pedidoId: number;
  codigo: string;
  clienteId: string | null;
  nombreCliente: string | null;
  alTerminar: () => void;
  alCerrar: () => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const [foto, setFoto] = useState<{ archivo: File; vista: string } | null>(null);
  // Espejo del object URL vigente, para poder soltarlo al cerrar sin leer el estado.
  const vistaRef = useRef("");
  const [recibio, setRecibio] = useState(nombreCliente?.trim() ?? "");
  const [tipo, setTipo] = useState("titular");
  const [nota, setNota] = useState("");
  const [firma, setFirma] = useState<Blob | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    dialogo.current?.showModal();
    // Al cerrar el diálogo se suelta la vista previa: un object URL vive hasta que se revoca
    // o hasta que se abandona la página, y aquí la página no se abandona.
    return () => {
      if (vistaRef.current) URL.revokeObjectURL(vistaRef.current);
    };
  }, []);

  const elegirFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    setError("");
    if (vistaRef.current) URL.revokeObjectURL(vistaRef.current);
    const vista = URL.createObjectURL(archivo);
    vistaRef.current = vista;
    setFoto({ archivo, vista });
  };

  const confirmar = async () => {
    if (!foto) return setError("Saca una foto de la entrega: es la constancia de que el pedido llegó.");
    if (!recibio.trim()) return setError("Escribe el nombre de quien recibió el pedido.");

    setGuardando(true);
    setError("");
    try {
      // Primero los archivos; si algo falla, el pedido no cambia de estado.
      const ruta = await subirEntrega(foto.archivo, pedidoId, clienteId);
      const rutaFirma = firma ? await subirFirma(firma, pedidoId, clienteId) : null;
      const { error: e } = await supabase.rpc("registrar_entrega", {
        p_pedido: pedidoId,
        p_foto: ruta,
        p_recibido_por: recibio.trim(),
        p_tipo: tipo,
        p_nota: nota.trim() || null,
        p_firma: rutaFirma,
      });
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
          <h2>Confirmar entrega</h2>
          <p className="caja__sub">Pedido {codigo}</p>
        </div>
        <button type="button" className="carrito__cerrar" aria-label="Cerrar" onClick={() => dialogo.current?.close()}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </button>
      </div>

      <div className="entrega__cuerpo">
        <section className="entrega__bloque">
          <h3>1 · Foto de la entrega</h3>
          <p className="caja__sub">La puerta, el paquete entregado o quien lo recibe. El cliente la verá en su cuenta.</p>

          <input
            ref={entrada}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            hidden
            onChange={elegirFoto}
          />

          {foto ? (
            <div className="entrega__vista">
              <img src={foto.vista} alt="Foto de la entrega que se va a guardar" />
              <button type="button" className="link" onClick={() => entrada.current?.click()} disabled={guardando}>
                Cambiar la foto
              </button>
            </div>
          ) : (
            <button type="button" className="entrega__camara" onClick={() => entrada.current?.click()} disabled={guardando}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.3l1.2-2h7l1.2 2h2.3A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5Z" />
                <circle cx="12" cy="13" r="3.4" />
              </svg>
              <span>Tomar o elegir la foto</span>
            </button>
          )}
        </section>

        <section className="entrega__bloque">
          <h3>2 · Quién recibió</h3>
          <div className="carrito__campo">
            <label htmlFor="entrega-recibio">Nombre de quien recibió</label>
            <input
              id="entrega-recibio"
              value={recibio}
              onChange={(e) => setRecibio(e.target.value)}
              placeholder="María Pérez"
              autoComplete="off"
              disabled={guardando}
            />
          </div>

          <fieldset className="entrega__quien">
            <legend>¿Quién recibió el pedido?</legend>
            {QUIEN.map((q) => (
              <label key={q.v} className={`entrega__opcion${tipo === q.v ? " is-on" : ""}`}>
                <input type="radio" name="entrega-tipo" value={q.v} checked={tipo === q.v} onChange={() => setTipo(q.v)} disabled={guardando} />
                <span>
                  <strong>{q.label}</strong>
                  <small>{q.ayuda}</small>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="carrito__campo">
            <label htmlFor="entrega-nota">Nota (opcional)</label>
            <input
              id="entrega-nota"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Lo dejé en portería, departamento 3B"
              disabled={guardando}
            />
          </div>
        </section>

        <section className="entrega__bloque">
          <h3>3 · Firma de quien recibe</h3>
          <p className="caja__sub">Opcional. Pásale el celular para que firme con el dedo.</p>
          <FirmaRecuadro alCambiar={setFirma} />
        </section>

        {error && <p className="carrito__error" role="alert">{error}</p>}
      </div>

      <div className="entrega__acciones">
        <button type="button" className="btn btn--primary" disabled={guardando} onClick={confirmar}>
          {guardando ? "Guardando…" : "Confirmar entrega"}
        </button>
        <button type="button" className="btn btn--secondary" disabled={guardando} onClick={() => dialogo.current?.close()}>
          Cancelar
        </button>
      </div>
    </dialog>
  );
}
