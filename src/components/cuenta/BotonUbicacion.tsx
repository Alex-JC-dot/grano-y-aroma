"use client";

import { useState } from "react";
import { enlaceMapa, ubicacionActual, type Punto } from "@/lib/ubicacion";

/** "Usar mi ubicación actual": llena la dirección y, si se puede guardar, deja el punto exacto. */
export default function BotonUbicacion({
  punto,
  alUbicar,
  alQuitar,
  deshabilitado = false,
}: {
  /** El punto ya elegido (solo donde se guarda). */
  punto?: Punto | null;
  alUbicar: (p: Punto) => void;
  alQuitar?: () => void;
  deshabilitado?: boolean;
}) {
  const [buscando, setBuscando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const buscar = async () => {
    setError("");
    setMensaje("");
    setBuscando(true);
    try {
      const p = await ubicacionActual();
      alUbicar(p);
      setMensaje(p.direccion ? "Revisa la calle y agrega el número de tu casa." : "Encontramos el punto, pero no el nombre de la calle: escríbelo arriba.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos encontrar tu ubicación.");
    } finally {
      setBuscando(false);
    }
  };

  return (
    <div className="ubicacion">
      <button type="button" className="ubicacion__boton" onClick={buscar} disabled={buscando || deshabilitado}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3.2" />
          <circle cx="12" cy="12" r="7" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
        {buscando ? "Buscando tu ubicación…" : punto ? "Actualizar mi ubicación" : "Usar mi ubicación actual"}
      </button>
      {punto && (
        <p className="ubicacion__punto">
          <span>Ubicación agregada{punto.metros <= 200 ? ` (±${punto.metros} m)` : ""}</span>
          <a href={enlaceMapa(punto.lat, punto.lng)} target="_blank" rel="noreferrer">Ver en el mapa</a>
          {alQuitar && <button type="button" onClick={() => { setMensaje(""); alQuitar(); }}>Quitar</button>}
        </p>
      )}
      {mensaje && <p className="ubicacion__nota" role="status">{mensaje}</p>}
      {error && <p className="carrito__error" role="alert">{error}</p>}
    </div>
  );
}
