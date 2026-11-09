"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * Animación del pie: un saco de yute del que se derraman granos verdes.
 *
 * Video de Kling volteado en espejo (el saco a la derecha, los granos caen hacia el nombre) y
 * convertido en 50 imágenes WebP (public/pie/saco). No fija nada en pantalla: el avance depende
 * de cuánto del pie ya entró en la ventana, así que no agrega scroll a la página.
 * Las imágenes solo se descargan cuando el pie está cerca, para no competir con el hero.
 */

const TOTAL = 50;
const ruta = (i: number) => `/pie/saco/${String(i + 1).padStart(3, "0")}.webp`;

const CONSULTA_REDUCIR = "(prefers-reduced-motion: reduce)";
function suscribirReducir(alCambiar: () => void) {
  const mq = window.matchMedia(CONSULTA_REDUCIR);
  mq.addEventListener("change", alCambiar);
  return () => mq.removeEventListener("change", alCambiar);
}

export default function SacoPie() {
  const marcoRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducir = useSyncExternalStore(
    suscribirReducir,
    () => window.matchMedia(CONSULTA_REDUCIR).matches,
    () => false,
  );

  useEffect(() => {
    const marco = marcoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!marco || !canvas || !ctx) return;

    let imagenes: HTMLImageElement[] = [];
    let actual = reducir ? TOTAL - 1 : 0;
    let raf = 0;
    let cargado = false;

    const masCercana = (i: number) => {
      for (let d = 0; d < TOTAL; d++) {
        const a = imagenes[i - d];
        if (a?.complete && a.naturalWidth) return a;
        const b = imagenes[i + d];
        if (b?.complete && b.naturalWidth) return b;
      }
      return null;
    };

    // Dibuja el fotograma cubriendo el marco (como object-fit: cover).
    const pintar = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (!w || !h) return;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const img = masCercana(actual);
      if (!img) return;
      const escala = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const dw = img.naturalWidth * escala;
      const dh = img.naturalHeight * escala;
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    };

    const cargar = () => {
      if (cargado) return;
      cargado = true;
      imagenes = Array.from({ length: TOTAL }, () => new Image());
      const orden = [actual, ...Array.from({ length: TOTAL }, (_, i) => i).filter((i) => i !== actual)];
      for (const i of orden) {
        const img = imagenes[i];
        img.decoding = "async";
        img.onload = () => {
          if (Math.abs(i - actual) <= 2) pintar();
        };
        img.src = ruta(i);
      }
    };

    // Progreso: 0 cuando el marco asoma por abajo, 1 al llegar al final de la página.
    const alHacerScroll = () => {
      if (reducir) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const vh = window.innerHeight;
        const inicio = marco.getBoundingClientRect().top + window.scrollY - vh;
        const fin = document.documentElement.scrollHeight - vh;
        const p = Math.min(1, Math.max(0, (window.scrollY - inicio) / Math.max(1, fin - inicio)));
        const fotograma = Math.round(p * (TOTAL - 1));
        if (fotograma !== actual) {
          actual = fotograma;
          pintar();
        }
      });
    };

    // Empieza a descargar cuando el pie está a ~1 pantalla de aparecer.
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          cargar();
          observador.disconnect();
        }
      },
      { rootMargin: "100% 0px" },
    );
    observador.observe(marco);

    alHacerScroll();
    window.addEventListener("scroll", alHacerScroll, { passive: true });
    window.addEventListener("resize", pintar);
    return () => {
      observador.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", alHacerScroll);
      window.removeEventListener("resize", pintar);
    };
  }, [reducir]);

  return (
    <div ref={marcoRef} className="foot__media">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Granos de café verde se derraman de un saco de yute"
      />
    </div>
  );
}
