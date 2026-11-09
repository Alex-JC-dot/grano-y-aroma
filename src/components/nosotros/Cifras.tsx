"use client";

import { useEffect, useRef, useState } from "react";
import { cafes } from "@/lib/catalogo";

/**
 * Franja de cifras de Nosotros. Todas se calculan de los cafés del catálogo (nada escrito a
 * mano), así que cambian solas cuando cambie el catálogo. Los números suben al aparecer.
 */

const origenes = new Set(cafes.map((c) => c.region.split(",")[0].trim())).size;
const alturas = cafes.map((c) => c.altitude);
const puntajes = cafes.map((c) => c.cuppingScore);
const promedio = puntajes.reduce((a, b) => a + b, 0) / puntajes.length;

const CIFRAS = [
  { valor: origenes, decimales: 0, sufijo: "", texto: "orígenes en La Paz y Chuquisaca" },
  { valor: cafes.length, decimales: 0, sufijo: "", texto: "cafés de origen en la tienda" },
  { valor: Math.max(...alturas), decimales: 0, sufijo: " msnm", texto: `altura máxima de nuestras fincas (la mínima, ${Math.min(...alturas).toLocaleString("es-BO")})` },
  { valor: promedio, decimales: 1, sufijo: "", texto: "puntos de catación en promedio" },
];

function Numero({ valor, decimales, sufijo, activo }: { valor: number; decimales: number; sufijo: string; activo: boolean }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!activo) return;
    // Con "reducir movimiento" la duración es 0: el primer cuadro ya muestra el valor final.
    const duracion = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1400;
    let raf = 0;
    const inicio = performance.now();
    const paso = (t: number) => {
      const p = duracion ? Math.min(1, (t - inicio) / duracion) : 1;
      setN(valor * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [activo, valor]);
  const texto = n.toLocaleString("es-BO", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
  return (
    <span className="cifra__valor">
      {/* El lector de pantalla lee el valor final, no la animación */}
      <span aria-hidden="true">
        {texto}
        {sufijo && <small className="cifra__unidad">{sufijo}</small>}
      </span>
      <span className="sr-only">
        {valor.toLocaleString("es-BO", { maximumFractionDigits: decimales })}
        {sufijo}
      </span>
    </span>
  );
}

export default function Cifras() {
  const ref = useRef<HTMLElement>(null);
  const [activo, setActivo] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (e) => {
        if (e.some((x) => x.isIntersecting)) {
          setActivo(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={ref} className="cifras" aria-label="Grano y Aroma en cifras">
      <div className="wrap">
        <ul className="cifras__lista">
          {CIFRAS.map((c) => (
            <li key={c.texto} className="cifra">
              <Numero valor={c.valor} decimales={c.decimales} sufijo={c.sufijo} activo={activo} />
              <span className="cifra__texto">{c.texto}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
