/* eslint-disable @next/next/no-img-element -- export estático: next/image no optimiza aquí */

/** Los personajes de las subastas (public/subastas). */

/** El martillero. El brazo va en otra imagen: al cambiar `golpe` da un martillazo. */
export function Martillero({ golpe = 0 }: { golpe?: number }) {
  return (
    <span className="martillero" aria-hidden="true">
      <img src="/subastas/martillero.webp" alt="" width={795} height={560} draggable={false} />
      <img key={golpe} className={`martillero__brazo${golpe ? " is-golpe" : ""}`} src="/subastas/martillero-brazo.webp" alt="" width={795} height={560} draggable={false} />
      {golpe > 0 && <span key={`o${golpe}`} className="martillero__onda" />}
    </span>
  );
}

/** El saquito de un lote: la imagen tiene la franja calada y detrás va el color del lote. */
export function Saco({ color }: { color: string }) {
  return (
    <span className="saco" style={{ "--franja": color } as React.CSSProperties} aria-hidden="true">
      <span className="saco__franja" />
      <img src="/subastas/saco.webp" alt="" width={390} height={420} draggable={false} />
    </span>
  );
}

const COLORES = ["#94492a", "#7d2a35", "#5d6b35", "#b5743c", "#4f6f8f", "#6b4a8a"];
/** El color de un lote: por la variedad si la dice el título; si no, uno fijo por lote. */
export function colorLote(l: { id: number; titulo: string }) {
  const t = l.titulo.toLowerCase();
  if (/gesh?a/.test(t)) return "#7d2a35";
  if (/bourbon/.test(t)) return "#b25a2b";
  if (/caturra/.test(t)) return "#5d6b35";
  return COLORES[l.id % COLORES.length];
}
