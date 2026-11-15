"use client";

import { useEffect, useRef } from "react";
import { alScroll, avanceDe, reducirMovimiento } from "@/lib/scrollAnimado";

/**
 * Club: el vertido de un pour-over que avanza con el scroll. Bajas y el agua cae sobre el café;
 * subes y retrocede. Mientras tanto aparecen los tres pasos de una entrega del Club.
 *
 * Igual que el hero del inicio, el video de Kling se convirtió en 121 imágenes WebP
 * (public/vertido/desktop 1280x720 y public/vertido/mobile 720x648, recorte centrado en el
 * filtro) y el avance del scroll elige cuál se dibuja en el <canvas>: es mucho más fluido que
 * adelantar un <video>.
 *
 * El paso visible se marca con data-paso en la sección (sin estado de React) y el CSS lo muestra.
 * Con "reducir movimiento" se dibuja el último cuadro y se ven los tres pasos a la vez.
 */

const TOTAL = 121;
const PASOS = [
  { titulo: "Lo tostamos para ti", texto: "Cada entrega sale del tueste de esa misma semana, nunca de una bodega." },
  { titulo: "Te llega a casa", texto: "Cada 15 o 30 días, en Sucre, sin que tengas que pedirlo." },
  { titulo: "Lo preparas a tu gusto", texto: "En grano o molido para tu V60, tu prensa o tu espresso." },
];

const ruta = (set: string, i: number) => `/vertido/${set}/${String(i + 1).padStart(3, "0")}.webp`;

export default function VertidoScroll() {
  const seccionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const seccion = seccionRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!seccion || !canvas || !ctx) return;

    const quieto = reducirMovimiento();
    const set = window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop";
    const imagenes = Array.from({ length: TOTAL }, () => new Image());
    let actual = quieto ? TOTAL - 1 : 0;

    // La imagen ya cargada más cercana al cuadro pedido (mientras el resto se descarga).
    const masCercana = (i: number) => {
      for (let d = 0; d < TOTAL; d++) {
        for (const j of [i - d, i + d]) {
          const img = imagenes[j];
          if (img?.complete && img.naturalWidth) return img;
        }
      }
      return null;
    };

    // Dibuja cubriendo todo el canvas (como object-fit: cover), anclado un poco a la izquierda
    // para que el filtro no se corte en pantallas angostas.
    const dibujar = () => {
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
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, (w - dw) * 0.4, (h - dh) / 2, dw, dh);
    };

    // Primero el cuadro actual y el último; después el resto en orden.
    const orden = [actual, TOTAL - 1, ...Array.from({ length: TOTAL }, (_, i) => i)];
    const pedidas = new Set<number>();
    for (const i of orden) {
      if (pedidas.has(i)) continue;
      pedidas.add(i);
      imagenes[i].decoding = "async";
      imagenes[i].onload = () => {
        if (Math.abs(i - actual) <= 2) dibujar();
      };
      imagenes[i].src = ruta(set, i);
    }

    if (quieto) {
      seccion.dataset.paso = "todos";
      window.addEventListener("resize", dibujar);
      dibujar();
      return () => window.removeEventListener("resize", dibujar);
    }

    return alScroll(() => {
      const p = avanceDe(seccion);
      // El video avanza en el 90 % del recorrido; el último 10 % deja la taza servida.
      const cuadro = Math.round(Math.min(1, p / 0.9) * (TOTAL - 1));
      seccion.dataset.paso = String(Math.min(PASOS.length - 1, Math.floor(p * PASOS.length)));
      seccion.style.setProperty("--p", p.toFixed(4));
      if (cuadro !== actual) actual = cuadro;
      dibujar();
    });
  }, []);

  return (
    <section ref={seccionRef} className="vertido" data-paso="0" aria-labelledby="vertido-titulo">
      <div className="vertido__escena">
        <canvas
          ref={canvasRef}
          className="vertido__canvas"
          role="img"
          aria-label="Una tetera de cobre vierte agua caliente sobre un filtro de café y el café cae en la jarra"
        />
        <div className="vertido__texto">
          <p className="eyebrow">Una entrega del Club</p>
          <h2 id="vertido-titulo">Del tostador a tu taza</h2>
          <ol className="vertido__pasos">
            {PASOS.map((p, i) => (
              <li key={p.titulo} data-i={i}>
                <span className="vertido__num" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{p.titulo}</h3>
                  <p>{p.texto}</p>
                </div>
              </li>
            ))}
          </ol>
          <a href="#configurar" className="btn btn--primary vertido__cta">
            Arma tu suscripción
          </a>
        </div>
        <div className="vertido__barra" aria-hidden="true">
          <span />
        </div>
      </div>
    </section>
  );
}
