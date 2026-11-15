"use client";

import { useEffect, useRef } from "react";
import { useProductos } from "@/store/catalogoStore";
import { categoriaDe } from "@/lib/catalogo";
import { alScroll, limitar } from "@/lib/scrollAnimado";
import TarjetaCafe from "./TarjetaCafe";

/**
 * Franja "Cafés de origen" de la tienda: mientras la persona baja con la rueda, la sección
 * se queda fija y los cafés en grano pasan de derecha a izquierda. Al terminar la fila, la
 * página sigue bajando normal hacia el catálogo completo.
 *
 * Cómo funciona: la sección mide de alto lo que tarda la fila en recorrerse (alto de pantalla
 * + distancia horizontal) y su interior es sticky. El avance del scroll (0 a 1) se convierte en
 * un translateX de la pista.
 *
 * En celular, tablet chica o con "reducir movimiento" no se ata al scroll: la fila se desliza
 * con el dedo (scroll horizontal nativo con imán), que es lo esperable en una pantalla táctil.
 */
export default function FranjaOrigen() {
  const productos = useProductos();
  const cafes = productos.filter((p) => categoriaDe(p) === "grano");
  const seccion = useRef<HTMLElement>(null);
  const pista = useRef<HTMLDivElement>(null);
  const contador = useRef<HTMLSpanElement>(null);
  const total = cafes.length;

  useEffect(() => {
    const s = seccion.current;
    const t = pista.current;
    if (!s || !t || !total) return;
    const modo = window.matchMedia("(min-width: 821px) and (prefers-reduced-motion: no-preference)");
    let distancia = 0;

    const medir = () => {
      if (!modo.matches) {
        s.dataset.modo = "deslizar";
        s.style.removeProperty("height");
        t.style.removeProperty("transform");
        return;
      }
      s.dataset.modo = "fijo";
      distancia = Math.max(0, t.scrollWidth - (t.parentElement?.clientWidth ?? window.innerWidth));
      s.style.height = `${window.innerHeight + distancia}px`;
    };

    const pintar = () => {
      if (s.dataset.modo !== "fijo") return;
      const r = s.getBoundingClientRect();
      const recorrido = r.height - window.innerHeight;
      const p = recorrido > 0 ? limitar(-r.top / recorrido) : 0;
      t.style.transform = `translate3d(${-p * distancia}px, 0, 0)`;
      s.style.setProperty("--p", p.toFixed(4));
      if (contador.current) contador.current.textContent = String(Math.round(p * (total - 1)) + 1).padStart(2, "0");
    };

    const rehacer = () => {
      medir();
      pintar();
    };
    rehacer();
    const quitar = alScroll(pintar);
    const observador = new ResizeObserver(rehacer);
    observador.observe(t);
    modo.addEventListener("change", rehacer);
    window.addEventListener("resize", rehacer);
    return () => {
      quitar();
      observador.disconnect();
      modo.removeEventListener("change", rehacer);
      window.removeEventListener("resize", rehacer);
    };
  }, [total]);

  if (!total) return null;

  return (
    <section ref={seccion} className="franja" data-modo="deslizar" aria-labelledby="franja-titulo">
      <div className="franja__fija">
        <div className="wrap franja__cabeza">
          <div>
            <p className="eyebrow">Cafés de origen</p>
            <h2 id="franja-titulo">De las fincas de Bolivia a tu taza</h2>
          </div>
          <p className="franja__contador" aria-hidden="true">
            <span ref={contador}>01</span> / {String(total).padStart(2, "0")}
          </p>
        </div>

        <div className="franja__ventana">
          <div ref={pista} className="franja__pista">
            {cafes.map((c, i) => (
              <TarjetaCafe key={c.id} producto={c} indice={i} revelar={false} />
            ))}
          </div>
        </div>

        <div className="wrap franja__pie">
          <div className="franja__barra" aria-hidden="true">
            <span />
          </div>
          <p className="franja__ayuda">
            <span className="franja__ayuda--fijo">Sigue bajando para recorrer los cafés</span>
            <span className="franja__ayuda--deslizar">Desliza para ver todos los cafés</span>
          </p>
        </div>
      </div>
    </section>
  );
}
