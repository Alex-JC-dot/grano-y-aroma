const COLORES = ["#94492a", "#7d2a35", "#5d6b35", "#b5743c", "#4f6f8f", "#6b4a8a"];
/** El color de un lote: por la variedad si la dice el título; si no, uno fijo por lote. */
export function colorLote(l: { id: number; titulo: string }) {
  const t = l.titulo.toLowerCase();
  if (/gesh?a/.test(t)) return "#7d2a35";
  if (/bourbon/.test(t)) return "#b25a2b";
  if (/caturra/.test(t)) return "#5d6b35";
  return COLORES[l.id % COLORES.length];
}
