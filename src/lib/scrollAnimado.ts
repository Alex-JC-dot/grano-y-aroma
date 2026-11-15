/**
 * Utilidades para animaciones atadas al scroll (franja horizontal de la tienda y recorrido
 * en capas de Nosotros).
 *
 * Las animaciones no pasan por el estado de React: cada cuadro se escriben variables CSS
 * (--p, --entra, --sale) directo en el DOM y el CSS hace el resto. Así el scroll no provoca
 * renders y se mantiene fluido incluso en celulares modestos.
 */

export const limitar = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

/**
 * Llama a `pintar` como máximo una vez por cuadro mientras haya scroll o cambio de tamaño.
 * Devuelve la función que quita los oyentes (para el return del useEffect).
 */
export function alScroll(pintar: () => void): () => void {
  let pendiente = false;
  const pedir = () => {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => {
      pendiente = false;
      pintar();
    });
  };
  window.addEventListener("scroll", pedir, { passive: true });
  window.addEventListener("resize", pedir);
  pedir();
  return () => {
    window.removeEventListener("scroll", pedir);
    window.removeEventListener("resize", pedir);
  };
}

/** true si la persona no pidió "reducir movimiento" en su sistema. */
export const conMovimiento = () => window.matchMedia("(prefers-reduced-motion: no-preference)").matches;
