"use client";

import { useEffect, useRef, useState } from "react";

/**
 * La animación con la que se abre el sitio, solo en el Inicio y una vez por visita.
 *
 * Pantalla de chocolate con el logo: el ícono se llena como una taza, el nombre aparece de
 * izquierda a derecha, un destello cruza el logo y el chocolate se vacía con olas hasta dejar ver la página.
 *
 * Si toca o no lo decide un script del layout ANTES del primer pintado (data-intro="si" en
 * <html>), para que no se vea la página un instante y luego la intro encima. Aquí solo se anima.
 * Un toque la salta. Con "reducir movimiento" no sale. Y si algo falla, ese mismo script la quita.
 */

const LLENA = 1150; // el ícono
const NOMBRE = 850; // el nombre
const BRILLO = 950; // el destello que cruza el logo
const PAUSA = 780; // desde que está el nombre; el destello casi termina
const VACIA = 1500; // el chocolate

const suave = (t: number) => 0.5 - Math.cos(Math.PI * t) / 2; // sin tirones al empezar ni al terminar
const limite = (t: number) => Math.max(0, Math.min(1, t));

/** Borde de olas a la altura `y`, hasta el fondo de la pantalla. */
function olas(w: number, h: number, y: number, alto: number, fase: number) {
  const pasos = 14;
  let d = `M0 ${h + 40}V${y + Math.sin(fase) * alto}`;
  for (let i = 1; i <= pasos; i++) {
    const x0 = ((i - 1) / pasos) * w, x1 = (i / pasos) * w;
    const f = (x: number) => y + Math.sin(fase + (x / w) * 6.4) * alto + Math.sin(fase * 1.3 + (x / w) * 11) * alto * 0.22;
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
    const brillo = c.querySelector<HTMLElement>(".ga-intro__brillo")!;
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
      const ola = (x: number) => nivel + Math.sin(ahora / 260 + x / 13) * 2.6 * (1 - lleno * 0.6);
      icono.style.clipPath = `polygon(${[0, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100].map((x) => `${x}% ${ola(x).toFixed(1)}%`).join(",")},100% 100%,0 100%)`;
      nombre.style.setProperty("--v", `${(suave(limite((t - LLENA * 0.72) / NOMBRE)) * 140).toFixed(1)}%`);

      const b = limite((t - LLENA * 0.72 - NOMBRE + 60) / BRILLO);
      brillo.style.setProperty("--b", `${(88 - suave(b) * 76).toFixed(1)}%`);
      brillo.style.opacity = String(Math.sin(Math.PI * b));

      if (!vaciar && t > LLENA * 0.72 + NOMBRE + PAUSA) vaciar = ahora;
      else if (!vaciar) chocolate.setAttribute("d", olas(w, h, -120, 0, 0)); // lleno: el degradado es el mismo al vaciarse
      if (vaciar) {
        const p = suave(limite((ahora - vaciar) / VACIA));
        const alto = 12 + Math.sin(p * Math.PI) * Math.min(30, h * 0.042);
        const y = -alto * 2 + p * (h + alto * 4);
        chocolate.setAttribute("d", olas(w, h, y, alto, ahora / 430));
        caramelo.setAttribute("d", olas(w, h, y - Math.sin(p * Math.PI) * h * 0.085, alto * 0.9, ahora / 520 + 1.4));
        logo.style.transform = `translateY(${p * h * 0.3}px) scale(${1 - p * 0.06})`;
        logo.style.opacity = String(1 - suave(limite(p * 1.9)));
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
        <span className="ga-intro__brillo"><i /></span>
      </div>
    </div>
  );
}
