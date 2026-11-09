"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * Video que se reproduce una sola vez cuando aparece en pantalla y se queda en su último
 * fotograma (la caja del Club, el saco de las Subastas). Sin audio y en loop no.
 *
 * - Se descarga cuando está a ~1 pantalla de aparecer (no compite con lo de arriba).
 * - "Reducir movimiento": no se reproduce y muestra la imagen final.
 * - `nombre`: archivos en public/video/<nombre>.webm|.mp4 y sus imágenes -inicio/-final.webp.
 */

const CONSULTA_REDUCIR = "(prefers-reduced-motion: reduce)";
function suscribirReducir(alCambiar: () => void) {
  const mq = window.matchMedia(CONSULTA_REDUCIR);
  mq.addEventListener("change", alCambiar);
  return () => mq.removeEventListener("change", alCambiar);
}

export default function VideoUnaVez({
  nombre,
  descripcion,
  className = "",
  bucle = false,
}: {
  nombre: string;
  descripcion: string;
  className?: string;
  /** En bucle: se reproduce mientras está en pantalla y se pausa al salir. */
  bucle?: boolean;
}) {
  const marcoRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reducir = useSyncExternalStore(
    suscribirReducir,
    () => window.matchMedia(CONSULTA_REDUCIR).matches,
    () => false,
  );

  useEffect(() => {
    const marco = marcoRef.current;
    const video = videoRef.current;
    if (!marco || !video || reducir) return;

    // Descarga una sola vez. Importante: si load() se llamara después de play(), reiniciaría
    // el video y lo dejaría en pausa (los dos observadores pueden avisar en cualquier orden).
    let cargado = false;
    const cargar = () => {
      if (cargado) return;
      cargado = true;
      video.preload = "auto";
      video.load();
    };

    const cerca = new IntersectionObserver(
      (e) => {
        if (e.some((x) => x.isIntersecting)) {
          cargar();
          cerca.disconnect();
        }
      },
      { rootMargin: "100% 0px" },
    );
    const aLaVista = new IntersectionObserver(
      (e) => {
        if (e.some((x) => x.isIntersecting)) {
          cargar();
          video.play().catch(() => {
            // Si el navegador bloquea la reproducción queda la imagen: no es un error.
          });
          if (!bucle) aLaVista.disconnect();
        } else if (bucle) {
          video.pause();
        }
      },
      { threshold: 0.4 },
    );
    cerca.observe(marco);
    aLaVista.observe(marco);
    return () => {
      cerca.disconnect();
      aLaVista.disconnect();
    };
  }, [reducir, bucle]);

  const base = `/video/${nombre}`;
  return (
    <div ref={marcoRef} className={`video-marco ${className}`}>
      <video
        ref={videoRef}
        muted
        loop={bucle}
        playsInline
        preload="none"
        poster={reducir ? `${base}-final.webp` : `${base}-inicio.webp`}
        aria-label={descripcion}
      >
        {!reducir && (
          <>
            <source src={`${base}.webm`} type="video/webm" />
            <source src={`${base}.mp4`} type="video/mp4" />
          </>
        )}
      </video>
    </div>
  );
}
