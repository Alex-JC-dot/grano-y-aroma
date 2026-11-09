"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * Cierre de la página: un saco de yute del que se derraman granos verdes, a todo el ancho,
 * con el nombre y el botón encima (lo que se pasa como children).
 *
 * Video de Kling volteado en espejo (el saco a la derecha) y convertido en 50 imágenes WebP
 * (public/pie/saco). Se reproduce solo, una vez y más lento que el original, cuando la
 * sección entra en pantalla; luego queda en el último fotograma. No depende del scroll.
 * Las imágenes solo se descargan cuando el pie está cerca, para no competir con el hero.
 */

const TOTAL = 50;
const DURACION_MS = 7500; // el video original dura 5 s: aquí va más lento para que se aprecie
const ruta = (i: number) => `/pie/saco/${String(i + 1).padStart(3, "0")}.webp`;

const CONSULTA_REDUCIR = "(prefers-reduced-motion: reduce)";
function suscribirReducir(alCambiar: () => void) {
  const mq = window.matchMedia(CONSULTA_REDUCIR);
  mq.addEventListener("change", alCambiar);
  return () => mq.removeEventListener("change", alCambiar);
}

export default function SacoPie({ children }: { children: React.ReactNode }) {
  const seccionRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducir = useSyncExternalStore(
    suscribirReducir,
    () => window.matchMedia(CONSULTA_REDUCIR).matches,
    () => false,
  );

  useEffect(() => {
    const seccion = seccionRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!seccion || !canvas || !ctx) return;

    let imagenes: HTMLImageElement[] = [];
    let listas = 0;
    let actual = reducir ? TOTAL - 1 : 0;
    let visible = false;
    let reproducida = false;
    let raf = 0;

    const masCercana = (i: number) => {
      for (let d = 0; d < TOTAL; d++) {
        const a = imagenes[i - d];
        if (a?.complete && a.naturalWidth) return a;
        const b = imagenes[i + d];
        if (b?.complete && b.naturalWidth) return b;
      }
      return null;
    };

    // Cubre la sección (como object-fit: cover) manteniendo el saco a la vista:
    // si hay que recortar a lo ancho, se recorta más de la izquierda que de la derecha.
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
      // Punto que queda a la vista al recortar (0 = izquierda, 1 = derecha): en pantallas anchas
      // el saco; en verticales un poco más al centro, para que entren la boca del saco y los granos.
      const enfoqueX = w >= h ? 0.68 : 0.55;
      const dx = Math.min(0, Math.max(w - dw, w / 2 - dw * enfoqueX));
      ctx.drawImage(img, dx, (h - dh) / 2, dw, dh);
    };

    const reproducir = () => {
      if (reproducida || reducir || !visible || listas < TOTAL) return;
      reproducida = true;
      const inicio = performance.now();
      const paso = (t: number) => {
        const p = Math.min(1, (t - inicio) / DURACION_MS);
        // Arranca y termina suave, como los granos que se asientan.
        const suave = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        const f = Math.round(suave * (TOTAL - 1));
        if (f !== actual) {
          actual = f;
          pintar();
        }
        if (p < 1) raf = requestAnimationFrame(paso);
      };
      raf = requestAnimationFrame(paso);
    };

    const cargar = () => {
      if (imagenes.length) return;
      imagenes = Array.from({ length: TOTAL }, () => new Image());
      imagenes.forEach((img, i) => {
        img.decoding = "async";
        img.onload = img.onerror = () => {
          listas++;
          if (i === actual) pintar();
          reproducir();
        };
        img.src = ruta(i);
      });
    };

    // Descarga cuando el pie está a ~1 pantalla; reproduce cuando se ve al menos un tercio.
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
        visible = e.some((x) => x.isIntersecting);
        reproducir();
      },
      { threshold: 0.35 },
    );
    cerca.observe(seccion);
    aLaVista.observe(seccion);

    window.addEventListener("resize", pintar);
    return () => {
      cerca.disconnect();
      aLaVista.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", pintar);
    };
  }, [reducir]);

  return (
    <div ref={seccionRef} className="foot__hero">
      <canvas
        ref={canvasRef}
        className="foot__canvas"
        role="img"
        aria-label="Granos de café verde se derraman de un saco de yute"
      />
      <div className="foot__veil" aria-hidden="true" />
      <div className="wrap foot__hero-content">{children}</div>
    </div>
  );
}
