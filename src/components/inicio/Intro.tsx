"use client";

import { useEffect, useRef, useState } from "react";

/**
 * La animación con la que se abre el sitio, solo en el Inicio y una vez por visita.
 *
 * Pantalla de chocolate con el logo: el ícono se llena como una taza, el nombre aparece de
 * izquierda a derecha y el chocolate se vacía con olas hasta dejar ver la página.
 *
 * Si toca o no lo decide un script del layout ANTES del primer pintado (data-intro="si" en
 * <html>), para que no se vea la página un instante y luego la intro encima. Aquí solo se anima.
 * Un toque la salta. Con "reducir movimiento" no sale. Y si algo falla, ese mismo script la quita.
 */

const LLENA = 900; // el ícono
const NOMBRE = 480; // el nombre
const PAUSA = 300;
const VACIA = 1000; // el chocolate

const suave = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const limite = (t: number) => Math.max(0, Math.min(1, t));

/** Borde de olas a la altura `y`, hasta el fondo de la pantalla. */
function olas(w: number, h: number, y: number, alto: number, fase: number) {
  const pasos = 14;
  let d = `M0 ${h + 40}V${y + Math.sin(fase) * alto}`;
  for (let i = 1; i <= pasos; i++) {
    const x0 = ((i - 1) / pasos) * w, x1 = (i / pasos) * w;
    const f = (x: number) => y + Math.sin(fase + (x / w) * 8.6) * alto + Math.sin(fase * 1.7 + (x / w) * 17) * alto * 0.32;
    d += `Q${(x0 + x1) / 2} ${2 * f((x0 + x1) / 2) - (f(x0) + f(x1)) / 2} ${x1} ${f(x1)}`;
  }
  return `${d}V${h + 40}Z`;
}

export default function Intro() {
  const caja = useRef<HTMLDivElement>(null);
  const [fin, setFin] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    const c = caja.current;
    if (!c || html.dataset.intro !== "si") return;
    const icono = c.querySelector<HTMLElement>(".ga-intro__lleno")!;
    const nombre = c.querySelector<HTMLElement>(".ga-intro__nombre")!;
    const logo = c.querySelector<HTMLElement>(".ga-intro__logo")!;
    const [caramelo, chocolate] = c.querySelectorAll("path");
    let cuadro = 0;
    let inicio = 0;
    let vaciar = 0; // cuándo empieza a vaciarse
    let vivo = true;

    const paso = (ahora: number) => {
      const w = window.innerWidth, h = window.innerHeight;
      const t = ahora - inicio;
      // El ícono se llena desde abajo, con la superficie ondulando.
      const lleno = suave(limite(t / LLENA));
      const nivel = 100 - lleno * 112;
      const ola = (x: number) => nivel + Math.sin(ahora / 170 + x / 11) * 3.2 * (1 - lleno * 0.6);
      icono.style.clipPath = `polygon(${[0, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100].map((x) => `${x}% ${ola(x).toFixed(1)}%`).join(",")},100% 100%,0 100%)`;
      nombre.style.clipPath = `inset(0 ${(100 - suave(limite((t - LLENA * 0.72) / NOMBRE)) * 100).toFixed(1)}% 0 0)`;

      if (!vaciar && t > LLENA * 0.72 + NOMBRE + PAUSA) vaciar = ahora;
      else if (!vaciar) chocolate.setAttribute("d", olas(w, h, -120, 0, 0)); // lleno: el degradado es el mismo al vaciarse
      if (vaciar) {
        const p = suave(limite((ahora - vaciar) / VACIA));
        const alto = 16 + Math.sin(p * Math.PI) * Math.min(46, h * 0.06);
        const y = -alto * 2 + p * (h + alto * 4);
        chocolate.setAttribute("d", olas(w, h, y, alto, ahora / 260));
        caramelo.setAttribute("d", olas(w, h, y - Math.sin(p * Math.PI) * h * 0.11, alto * 0.9, ahora / 320 + 2));
        logo.style.transform = `translateY(${p * h * 0.42}px) scale(${1 - p * 0.12})`;
        logo.style.opacity = String(limite(1 - p * 2.1));
        if (p >= 1) return terminar();
      }
      cuadro = requestAnimationFrame(paso);
    };
    const terminar = () => {
      html.dataset.intro = "fin";
      setFin(true);
    };
    const saltar = () => {
      if (!vaciar) vaciar = performance.now();
    };

    // Se espera al logo (poco): si el internet está lento, la intro empieza igual.
    const img = new Image();
    img.src = "/intro-logo.webp";
    Promise.race([img.decode().catch(() => {}), new Promise((r) => window.setTimeout(r, 1200))]).then(() => {
      if (!vivo) return;
      inicio = performance.now();
      cuadro = requestAnimationFrame(paso);
    });
    c.addEventListener("pointerdown", saltar);
    window.addEventListener("keydown", saltar);
    return () => {
      vivo = false;
      cancelAnimationFrame(cuadro);
      c.removeEventListener("pointerdown", saltar);
      window.removeEventListener("keydown", saltar);
    };
  }, []);

  if (fin) return null;
  return (
    <div ref={caja} className="ga-intro" aria-hidden="true">
      <svg className="ga-intro__liquido">
        <defs>
          <linearGradient id="ga-intro-chocolate" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#4a291b" />
            <stop offset="1" stopColor="#25120b" />
          </linearGradient>
        </defs>
        <path className="ga-intro__caramelo" d="M0 -60H9999V9999H0Z" />
        <path className="ga-intro__chocolate" d="M0 -60H9999V9999H0Z" />
      </svg>
      <div className="ga-intro__logo">
        <span className="ga-intro__icono ga-intro__vacio" />
        <span className="ga-intro__icono ga-intro__lleno" />
        <span className="ga-intro__nombre" />
      </div>
    </div>
  );
}
