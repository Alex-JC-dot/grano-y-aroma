/* eslint-disable @next/next/no-img-element -- export estático: next/image no optimiza aquí */
import type { Product } from "@/lib/types";
import { colorDe } from "@/lib/catalogo";

/**
 * La "foto" de la bolsa de un café.
 *
 * Mientras no estén las fotos de las bolsas, dibuja un panel crema con la etiqueta del color
 * del café (el nombre y el código de lote como texto real). Cuando exista la foto en
 * `/images/bolsas/<id>.webp`, basta con pasar `foto` y se muestra la imagen.
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
  if (foto) {
    return (
      <div className={`bolsa${grande ? " bolsa--grande" : ""}`}>
        <img src={foto} alt={`Bolsa de café ${producto.name}`} loading="lazy" decoding="async" />
      </div>
    );
  }

  return (
    <div
      className={`bolsa bolsa--panel${grande ? " bolsa--grande" : ""}`}
      style={{ "--etiqueta": colorDe(producto) } as React.CSSProperties}
      role="img"
      aria-label={`Bolsa de café ${producto.name}`}
    >
      <div className="bolsa__cuerpo" aria-hidden="true">
        <span className="bolsa__marca">Grano y Aroma</span>
        <span className="bolsa__etiqueta">
          <span className="bolsa__nombre">{producto.name}</span>
          <span className="bolsa__lote">{producto.lotCode}</span>
        </span>
      </div>
    </div>
  );
}
