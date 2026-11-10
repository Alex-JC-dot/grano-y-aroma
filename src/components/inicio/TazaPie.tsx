"use client";

import { useRuta } from "@/lib/ruta";
import { useEffect, useRef, useSyncExternalStore } from "react";

// Video del cierre por página: en Nosotros la tostadora (con sombra a la izquierda para el
// texto); en el resto, la taza humeante.
const VIDEOS = {
  taza: { base: "/pie/taza", poster: "/pie/taza-poster.webp", desc: "Una taza de capuchino humeante con arte latte sobre una mesa de madera oscura" },
  tostadora: { base: "/video/tostadora", poster: "/video/tostadora-inicio.webp", desc: "Granos recién tostados caen del tambor de la tostadora a la bandeja de enfriado" },
};

/**
 * Cierre de la página: banda oscura a todo el ancho con una taza de café humeante a la
 * derecha (video de Kling) y el texto en crema sobre la zona oscura de la izquierda.
 *
 * El video es un loop de 4 s sin salto (el final se funde con el inicio), en 1080p y sin
 * audio: public/pie/taza.webm (~100 KB) y .mp4 (~390 KB). Se descarga cuando el pie está
 * cerca, se reproduce mientras la sección está en pantalla y se pausa al salir.
 * Con "reducir movimiento" queda la imagen fija.
 */

const CONSULTA_REDUCIR = "(prefers-reduced-motion: reduce)";
function suscribirReducir(alCambiar: () => void) {
  const mq = window.matchMedia(CONSULTA_REDUCIR);
  mq.addEventListener("change", alCambiar);
  return () => mq.removeEventListener("change", alCambiar);
}

export default function TazaPie({ children }: { children: React.ReactNode }) {
  const ruta = useRuta();
  const clave = ruta === "/nosotros" ? "tostadora" : "taza";
  const v = VIDEOS[clave];
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

    // Descarga una sola vez: un load() después de play() reiniciaría el video en pausa.
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
            // Si el navegador bloquea la reproducción, queda la imagen fija: no es un error.
          });
        } else {
          video.pause();
        }
      },
      { threshold: 0.2 },
    );

    cerca.observe(seccion);
    aLaVista.observe(seccion);
    return () => {
      cerca.disconnect();
      aLaVista.disconnect();
    };
  }, [reducir, clave]);

  return (
    <div ref={seccionRef} className={`foot__dark foot__dark--${clave}`}>
      <video
        key={clave}
        ref={videoRef}
        className="foot__video"
        muted
        loop
        playsInline
        preload="none"
        poster={v.poster}
        aria-label={v.desc}
      >
        {!reducir && (
          <>
            <source src={`${v.base}.webm`} type="video/webm" />
            <source src={`${v.base}.mp4`} type="video/mp4" />
          </>
        )}
      </video>
      <div className="wrap foot__dark-content">{children}</div>
    </div>
  );
}
