"use client";
/* eslint-disable @next/next/no-img-element -- export estático: next/image no optimiza aquí */

import { useRef, useState } from "react";
import { subirFoto } from "@/lib/archivos";

/**
 * Elegir la foto de un producto o de una subasta: el primer recuadro sube una foto nueva desde
 * la computadora o el celular (Supabase Storage); los demás son las fotos que ya tiene la web.
 * La foto subida queda elegida y se muestra junto a las demás.
 */
export default function SelectorFoto({
  carpeta,
  valor,
  galeria,
  alCambiar,
  conSinFoto = false,
  etiqueta,
}: {
  carpeta: "productos" | "subastas";
  valor: string;
  galeria: { src: string; alt?: string }[];
  alCambiar: (src: string) => void;
  /** Agrega la opción "Sin foto" (para el café, que usa la bolsa con su color). */
  conSinFoto?: boolean;
  etiqueta: string;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [subidas, setSubidas] = useState<string[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");

  const elegir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    setError("");
    setSubiendo(true);
    try {
      const url = await subirFoto(archivo, carpeta);
      setSubidas((xs) => [url, ...xs]);
      alCambiar(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la foto.");
    } finally {
      setSubiendo(false);
    }
  };

  // La foto elegida puede venir de antes (por ejemplo al editar) y no estar en la galería.
  const propias = [...subidas, ...(valor && !subidas.includes(valor) && !galeria.some((g) => g.src === valor) ? [valor] : [])];
  const opciones = [...(conSinFoto ? [{ src: "" }] : []), ...propias.map((src) => ({ src })), ...galeria];

  return (
    <div>
      <div className="admin-sub__fotos" role="radiogroup" aria-label={etiqueta}>
        <button type="button" className="admin-sub__foto foto-subir" onClick={() => entrada.current?.click()} disabled={subiendo}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M12 16V4m0 0-4.5 4.5M12 4l4.5 4.5M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
          </svg>
          <span>{subiendo ? "Subiendo…" : "Subir foto"}</span>
        </button>
        <input ref={entrada} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={elegir} />
        {opciones.map((o) => (
          <label key={o.src || "ninguna"} className={`admin-sub__foto${valor === o.src ? " is-on" : ""}`}>
            <input type="radio" name={`foto-${carpeta}`} value={o.src} checked={valor === o.src} onChange={() => alCambiar(o.src)} className="sr-only" />
            {o.src ? <img src={o.src} alt={"alt" in o ? o.alt ?? "" : "Foto subida"} loading="lazy" /> : <span className="admin-prod__sinfoto">Sin foto</span>}
          </label>
        ))}
      </div>
      <p className="caja__sub foto-subir__ayuda">JPG, PNG o WebP de hasta 5 MB. Se achica sola antes de subir.</p>
      {error && <p className="carrito__error" role="alert">{error}</p>}
    </div>
  );
}
