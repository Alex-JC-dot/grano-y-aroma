/* eslint-disable @next/next/no-img-element -- export estático: next/image no optimiza aquí */
import type { Product } from "@/lib/types";
import { colorDe } from "@/lib/catalogo";

/**
 * La bolsa de un café.
 *
 * Usa una sola foto de bolsa kraft con la franja en blanco (public/images/tienda/bolsa-base.webp,
 * generada con Kling y limpiada) y le pone encima, con HTML, la franja del color del café, su
 * nombre, su código de lote y la marca impresa en el kraft. Así una imagen sirve para todos
 * los cafés, también los que se agreguen después desde Supabase.
 *
 * Si algún café tiene su propia foto, se pasa en `foto` y se muestra tal cual.
 */
export default function BolsaVisual({
  producto,
  foto,
  grande = false,
}: {
  producto: Product;
  foto?: string;
  grande?: boolean;
}) {
  const clase = `bolsa${grande ? " bolsa--grande" : ""}`;

  // Producto con foto propia (frasco, jarabe, vaso…): la foto y, sobre su etiqueta en blanco,
  // la marca y el nombre escritos con HTML.
  if (producto.foto) {
    const { src, etiqueta: e } = producto.foto;
    return (
      <div className={`${clase} bolsa--foto`} role="img" aria-label={`${producto.name}${producto.presentacion ? `, ${producto.presentacion.toLowerCase()}` : ""}`}>
        <img src={src} alt="" loading="lazy" decoding="async" />
        {e && (
          <span
            className={`etiqueta etiqueta--${e.tono}`}
            style={{ left: `${e.x}%`, top: `${e.y}%`, width: `${e.w}%`, height: `${e.h}%` }}
            aria-hidden="true"
          >
            <span className="etiqueta__marca">Grano y Aroma</span>
            {e.texto && <span className="etiqueta__texto">{e.texto}</span>}
          </span>
        )}
      </div>
    );
  }

  if (foto) {
    return (
      <div className={clase}>
        <img src={foto} alt={`Bolsa de café ${producto.name}`} loading="lazy" decoding="async" />
      </div>
    );
  }

  return (
    <div
      className={`${clase} bolsa--compuesta`}
      style={{ "--etiqueta": colorDe(producto) } as React.CSSProperties}
      role="img"
      aria-label={`Bolsa de café ${producto.name}, lote ${producto.lotCode}`}
    >
      <div className="bolsa__foto" aria-hidden="true">
        <img src="/images/tienda/bolsa-base.webp" alt="" loading="lazy" decoding="async" />
        <span className="bolsa__marca">Grano y Aroma</span>
        <span className="bolsa__franja">
          <span className="bolsa__nombre">{producto.name}</span>
          <span className="bolsa__lote">{producto.lotCode}</span>
        </span>
      </div>
    </div>
  );
}
