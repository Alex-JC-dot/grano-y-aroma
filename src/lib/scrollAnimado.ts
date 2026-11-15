/**
 * Utilidades para escenas atadas al scroll (vertido del Club y paisaje de los Yungas).
 *
 * Las escenas no pasan por el estado de React: en cada cuadro se escriben variables CSS o se
 * dibuja en un canvas directamente. Así el scroll no provoca renders y se mantiene fluido.
 */

export const limitar = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

/**
 * Avance (0 a 1) de una sección "sticky": 0 cuando su borde superior llega arriba de la
 * ventana, 1 cuando su borde inferior llega abajo.
 */
export function avanceDe(seccion: HTMLElement): number {
  const recorrido = seccion.offsetHeight - window.innerHeight;
  return recorrido > 0 ? limitar(-seccion.getBoundingClientRect().top / recorrido) : 0;
}

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

/** true si la persona pidió "reducir movimiento" en su sistema. */
export const reducirMovimiento = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
