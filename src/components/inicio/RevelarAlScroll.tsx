"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Hace aparecer los bloques marcados con `data-revelar` cuando entran en pantalla:
 * suben 16 px mientras se vuelven visibles, en 0.5 s, una sola vez. Con `style={{ "--i": n }}`
 * se escalonan (80 ms por elemento, hasta 6).
 *
 * El contenido nunca depende de esto: los estilos que lo ocultan solo se aplican cuando este
 * componente marca <html data-revelar-activo="on">, y no lo hace con "reducir movimiento".
 */
export default function RevelarAlScroll() {
  // El layout no se vuelve a montar al navegar entre páginas: se reobserva en cada ruta.
  const ruta = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const raiz = document.documentElement;

    // El pie pertenece al layout y no se vuelve a montar al cambiar de página: se le quita la
    // marca de "visto" (si no está en pantalla) para que vuelva a entrar en cada página.
    document.querySelectorAll<HTMLElement>(".foot--desliza[data-visible]").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top > window.innerHeight || r.bottom < 0) el.removeAttribute("data-visible");
    });

    const elementos = Array.from(document.querySelectorAll<HTMLElement>("[data-revelar]:not([data-visible])"));
    if (!elementos.length) return;

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) {
            // Atributo propio (no una clase): React reescribe className al volver a renderizar
            // y borraría la marca, dejando el bloque invisible.
            e.target.setAttribute("data-visible", "");
            observador.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );

    raiz.dataset.revelarActivo = "on";
    elementos.forEach((el) => observador.observe(el));
    // Al cambiar de página solo se deja de observar: el interruptor de <html> se mantiene para
    // que los bloques de la página nueva no aparezcan y desaparezcan (parpadeo).
    return () => observador.disconnect();
  }, [ruta]);

  return null;
}
