"use client";

import { useEffect } from "react";

/**
 * Hace aparecer los bloques marcados con `data-revelar` cuando entran en pantalla:
 * suben 16 px mientras se vuelven visibles, en 0.5 s, una sola vez. Con `style={{ "--i": n }}`
 * se escalonan (80 ms por elemento, hasta 6).
 *
 * El contenido nunca depende de esto: los estilos que lo ocultan solo se aplican cuando este
 * componente marca <html data-revelar-activo="on">, y no lo hace con "reducir movimiento".
 */
export default function RevelarAlScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const raiz = document.documentElement;
    const elementos = Array.from(document.querySelectorAll<HTMLElement>("[data-revelar]"));
    if (!elementos.length) return;

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            observador.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );

    raiz.dataset.revelarActivo = "on";
    elementos.forEach((el) => observador.observe(el));
    return () => {
      observador.disconnect();
      delete raiz.dataset.revelarActivo;
    };
  }, []);

  return null;
}
