"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const CONSULTA_REDUCIR = "(prefers-reduced-motion: reduce)";

function suscribirReducir(alCambiar: () => void) {
  const mq = window.matchMedia(CONSULTA_REDUCIR);
  mq.addEventListener("change", alCambiar);
  return () => mq.removeEventListener("change", alCambiar);
}

/** true si el visitante pidió "reducir movimiento" en su sistema. */
function useReducirMovimiento() {
  return useSyncExternalStore(
    suscribirReducir,
    () => window.matchMedia(CONSULTA_REDUCIR).matches,
    () => false,
  );
}

/**
 * Hero con animación ligada al scroll.
 *
 * El video de Kling se convirtió en 121 imágenes WebP (public/hero/desktop y public/hero/mobile).
 * La sección mide 3 pantallas; la escena queda fija (sticky) y el avance del scroll elige qué
 * imagen se dibuja en el <canvas>. Dibujar imágenes es mucho más fluido que adelantar un <video>.
 *
 * - Escritorio: imágenes 1440x810, ajustadas al alto; si sobra ancho se estira la columna del borde
 *   para que el fondo del video se funda sin corte.
 * - Celular: recorte vertical del centro (640x800).
 * - "Reducir movimiento": se muestra el último fotograma, sin scroll.
 */

const TOTAL = 121;
const FIN_ANIMACION = 0.95; // casi todo el scroll anima; solo un respiro al final

const PASOS = [
  {
    num: "01",
    titulo: "Grano de altura",
    texto: "Cafés de los Yungas, Caranavi y los valles de Chuquisaca, comprados por lote a cada productor.",
  },
  {
    num: "02",
    titulo: "Tostado por lotes",
    texto: "Cada lote lleva su curva de tueste, su puntaje de catación y un código que lo rastrea hasta la finca.",
  },
  {
    num: "03",
    titulo: "Molido a tu medida",
    texto: "Grano entero o molido para V60, espresso o prensa francesa. Enviamos a domicilio en Sucre.",
  },
];

function ruta(set: "desktop" | "mobile", i: number) {
  return `/hero/${set}/${String(i + 1).padStart(3, "0")}.webp`;
}

export default function HeroScroll({ precioDesde }: { precioDesde: string }) {
  const seccionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducir = useReducirMovimiento();
  const [pasoScroll, setPaso] = useState(0);
  const [progresoScroll, setProgreso] = useState(0);
  // Con movimiento reducido no hay scroll: se muestra directamente el último paso.
  const paso = reducir ? PASOS.length - 1 : pasoScroll;
  const progreso = reducir ? 1 : progresoScroll;

  useEffect(() => {
    const seccion = seccionRef.current;
    const canvas = canvasRef.current;
    if (!seccion || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const esCelular = window.matchMedia("(max-width: 767px)");
    let set: "desktop" | "mobile" = esCelular.matches ? "mobile" : "desktop";
    let imagenes: HTMLImageElement[] = [];
    let actual = reducir ? TOTAL - 1 : 0;
    let raf = 0;

    // Busca la imagen cargada más cercana al fotograma pedido (mientras el resto se descarga).
    const masCercana = (i: number) => {
      for (let d = 0; d < TOTAL; d++) {
        const a = imagenes[i - d];
        if (a?.complete && a.naturalWidth) return a;
        const b = imagenes[i + d];
        if (b?.complete && b.naturalWidth) return b;
      }
      return null;
    };

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
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const escala = h / ih;
      const dw = iw * escala;
      const dx = (w - dw) / 2;
      ctx.imageSmoothingQuality = "high";
      if (dx > 0) {
        // Estira la primera y la última columna del fotograma para rellenar los costados sin corte.
        ctx.drawImage(img, 0, 0, 1, ih, 0, 0, Math.ceil(dx) + 1, h);
        ctx.drawImage(img, iw - 1, 0, 1, ih, Math.floor(dx + dw) - 1, 0, Math.ceil(dx) + 2, h);
      }
      ctx.drawImage(img, 0, 0, iw, ih, dx, 0, dw, h);
    };

    const cargar = () => {
      imagenes = Array.from({ length: TOTAL }, () => new Image());
      // Primero el fotograma actual y el final, después el resto en orden.
      const orden = [actual, TOTAL - 1, ...Array.from({ length: TOTAL }, (_, i) => i)];
      const pedidas = new Set<number>();
      for (const i of orden) {
        if (pedidas.has(i)) continue;
        pedidas.add(i);
        const img = imagenes[i];
        img.decoding = "async";
        img.onload = () => {
          if (Math.abs(i - actual) <= 2) pintar();
        };
        img.src = ruta(set, i);
      }
    };

    const alHacerScroll = () => {
      if (reducir) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // La escena (alto de pantalla menos la barra) queda fija hasta que el final de la sección
        // llega al borde inferior de la ventana: ese es el recorrido útil del scroll.
        const recorrido = seccion.offsetHeight - window.innerHeight;
        const p = Math.min(1, Math.max(0, -seccion.getBoundingClientRect().top / Math.max(1, recorrido)));
        const pa = Math.min(1, p / FIN_ANIMACION);
        const fotograma = Math.round(pa * (TOTAL - 1));
        if (fotograma !== actual) {
          actual = fotograma;
          pintar();
        }
        // El grano se abre hacia el 25% del video y la jarra se llena hacia el 60%.
        setPaso(pa < 0.25 ? 0 : pa < 0.6 ? 1 : 2);
        setProgreso(pa);
      });
    };

    const alCambiarTamano = () => {
      const nuevo = esCelular.matches ? "mobile" : "desktop";
      if (nuevo !== set) {
        set = nuevo;
        cargar();
      }
      pintar();
    };

    cargar();
    pintar();
    alHacerScroll();
    window.addEventListener("scroll", alHacerScroll, { passive: true });
    window.addEventListener("resize", alCambiarTamano);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", alHacerScroll);
      window.removeEventListener("resize", alCambiarTamano);
    };
  }, [reducir]);

  // Avance de cada uno de los tres tramos de la barra de progreso.
  const tramos = [0.25, 0.6, 1].map((fin, i, arr) => {
    const inicio = i === 0 ? 0 : arr[i - 1];
    return Math.min(1, Math.max(0, (progreso - inicio) / (fin - inicio)));
  });

  return (
    <section
      ref={seccionRef}
      className={`hero${reducir ? " hero--static" : ""}`}
      aria-labelledby="hero-titulo"
    >
      <div className="hero__stage">
        <canvas
          ref={canvasRef}
          className="hero__canvas"
          role="img"
          aria-label="Un grano de café tostado se abre en el aire y su café molido cae dentro de una jarra de vidrio"
        />
        <div className="hero__content wrap">
          <div className="hero__text">
            <h1 id="hero-titulo" className="hero__title">
              Café de especialidad tostado en Sucre
            </h1>
            <p className="hero__fact">
              Cafés de origen boliviano con su lote rastreable, desde {precioDesde}.
            </p>
            <Link href="/tienda" className="btn btn--primary">
              Comprar café
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </Link>
          </div>

          <div className="hero__steps" aria-live="polite">
            {PASOS.map((p, i) => (
              <div key={p.num} className={`step${i === paso ? " is-active" : ""}`} aria-hidden={i !== paso}>
                <span className="step__num">
                  {p.num} / 03
                </span>
                <h2 className="step__title">{p.titulo}</h2>
                <p className="step__body">{p.texto}</p>
              </div>
            ))}
            <div className="hero__progress" aria-hidden="true">
              {tramos.map((t, i) => (
                <span key={i}>
                  <i style={{ "--p": t } as React.CSSProperties} />
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
