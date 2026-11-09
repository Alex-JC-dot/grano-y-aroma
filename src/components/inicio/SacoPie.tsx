"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * Cierre de la página: un saco de yute del que se derraman granos verdes, a todo el ancho,
 * como una banda panorámica sin nada encima (opción B). El nombre y el botón van debajo.
 *
 * Es el video de Kling en 1080p, volteado en espejo y sin audio (public/pie/saco.webm y .mp4,
 * ~0.3-0.7 MB). Como aquí no depende del scroll, se usa un <video> normal: calidad completa
 * y 24 fotogramas por segundo. Se reproduce una vez, a su velocidad original (5 s), cuando
 * la sección entra en pantalla, y queda en el último fotograma.
 * El video solo se descarga cuando el pie está cerca. Con "reducir movimiento" se muestra
 * directamente la imagen final.
 */

const CONSULTA_REDUCIR = "(prefers-reduced-motion: reduce)";
function suscribirReducir(alCambiar: () => void) {
  const mq = window.matchMedia(CONSULTA_REDUCIR);
  mq.addEventListener("change", alCambiar);
  return () => mq.removeEventListener("change", alCambiar);
}

export default function SacoPie() {
  const seccionRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reducir = useSyncExternalStore(
    suscribirReducir,
    () => window.matchMedia(CONSULTA_REDUCIR).matches,
    () => false,
  );

  useEffect(() => {
    const seccion = seccionRef.current;
    const video = videoRef.current;
    if (!seccion || !video || reducir) return;

    let reproducido = false;

    // Empieza a descargar cuando el pie está a ~1 pantalla.
    const cerca = new IntersectionObserver(
      (e) => {
        if (e.some((x) => x.isIntersecting)) {
          video.preload = "auto";
          video.load();
          cerca.disconnect();
        }
      },
      { rootMargin: "100% 0px" },
    );

    // Se reproduce una vez cuando se ve al menos un tercio de la sección.
    const aLaVista = new IntersectionObserver(
      (e) => {
        if (!reproducido && e.some((x) => x.isIntersecting)) {
          reproducido = true;
          video.play().catch(() => {
            // Si el navegador bloquea la reproducción, queda la imagen inicial: no es un error.
          });
          aLaVista.disconnect();
        }
      },
      { threshold: 0.35 },
    );

    cerca.observe(seccion);
    aLaVista.observe(seccion);
    return () => {
      cerca.disconnect();
      aLaVista.disconnect();
    };
  }, [reducir]);

  return (
    <div ref={seccionRef} className="foot__band">
      <video
        ref={videoRef}
        className="foot__video"
        muted
        playsInline
        preload="none"
        poster={reducir ? "/pie/saco-final.webp" : "/pie/saco-inicio.webp"}
        aria-label="Granos de café verde se derraman de un saco de yute"
      >
        {!reducir && (
          <>
            <source src="/pie/saco.webm" type="video/webm" />
            <source src="/pie/saco.mp4" type="video/mp4" />
          </>
        )}
      </video>
      <div className="foot__fade" aria-hidden="true" />
    </div>
  );
}
