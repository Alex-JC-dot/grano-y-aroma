"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MapaGL } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { estiloMapa, PLAZA } from "./estiloMapa";

/**
 * "Visítanos": un mapa de lado a lado, en los colores del sitio, que se funde con la página y
 * marca la Plaza 25 de Mayo de Sucre.
 *
 * El mapa (MapLibre) se descarga recién cuando la sección está por verse. La rueda del mouse no lo
 * acerca, para no atrapar a quien solo está bajando por la página: se usa + y −, o Ctrl + rueda (dos
 * dedos en el celular). Si no hay internet o la tarjeta gráfica no puede, queda la imagen fija.
 */

const COMO_LLEGAR = `https://www.google.com/maps/dir/?api=1&destination=${PLAZA[1]},${PLAZA[0]}`;
const WHATSAPP = "https://wa.me/59174814521";
const temaActual = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");
const CERCA = 16.6;
/** Copia de node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs: si se actualiza la librería, se copia de nuevo. */
const TRABAJADOR = "/mapa/maplibre-worker-6.19.0.js";

export default function MapaVisita() {
  const seccion = useRef<HTMLElement>(null);
  const lienzo = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaGL | null>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const s = seccion.current, l = lienzo.current;
    if (!s || !l) return;
    let vivo = true;
    let pedido = false;
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // En la computadora la tarjeta tapa la izquierda: el punto se corre hacia el espacio libre.
    const margen = () => (s.clientWidth >= 900 ? { left: Math.min(560, s.clientWidth * 0.4), right: 0, top: 0, bottom: 0 } : { left: 0, right: 0, top: 0, bottom: Math.round(l.clientHeight * 0.42) });

    const cargar = async () => {
      if (pedido) return;
      pedido = true;
      try {
        const gl = await import("maplibre-gl");
        if (!vivo) return;
        gl.setWorkerUrl(TRABAJADOR);
        const m = new gl.Map({
          container: l,
          style: estiloMapa(temaActual()),
          center: PLAZA,
          zoom: quieto ? CERCA : 13.4,
          pitch: quieto ? 48 : 0,
          bearing: quieto ? -24 : 0,
          minZoom: 11,
          maxZoom: 18.5,
          attributionControl: false,
          cooperativeGestures: true,
          locale: {
            "CooperativeGesturesHandler.WindowsHelpText": "Usa Ctrl + la rueda para acercar el mapa",
            "CooperativeGesturesHandler.MacHelpText": "Usa ⌘ + la rueda para acercar el mapa",
            "CooperativeGesturesHandler.MobileHelpText": "Usa dos dedos para mover el mapa",
            "NavigationControl.ZoomIn": "Acercar",
            "NavigationControl.ZoomOut": "Alejar",
          },
        });
        mapa.current = m;
        m.setPadding(margen());
        m.addControl(new gl.NavigationControl({ showCompass: false }), "bottom-right");
        m.addControl(new gl.AttributionControl({ compact: false }), "bottom-left");
        const pin = document.createElement("div");
        pin.className = "mapa-visita__pin";
        pin.innerHTML = '<span class="mapa-visita__gota"><i></i></span><b>Grano y Aroma</b>';
        new gl.Marker({ element: pin, anchor: "bottom" }).setLngLat(PLAZA).addTo(m);
        m.on("error", () => {}); // sin llenar la consola
        // Se muestra solo cuando hay calles dibujadas: sin internet el mapa también queda "quieto".
        let visto = false;
        m.on("idle", () => {
          if (!vivo || visto || !m.getLayer("calles") || !m.queryRenderedFeatures({ layers: ["calles", "avenidas"] }).length) return;
          visto = true;
          setListo(true);
          if (!quieto) m.flyTo({ center: PLAZA, zoom: CERCA, pitch: 48, bearing: -24, duration: 4200, curve: 1.3, padding: margen() });
        });
      } catch {
        // Sin WebGL: queda la imagen fija.
      }
    };

    const ver = new IntersectionObserver((e) => e[0].isIntersecting && cargar(), { rootMargin: "500px 0px" });
    ver.observe(s);
    const tema = new MutationObserver(() => mapa.current?.setStyle(estiloMapa(temaActual())));
    tema.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const medir = () => mapa.current?.setPadding(margen());
    window.addEventListener("resize", medir);
    return () => {
      vivo = false;
      ver.disconnect();
      tema.disconnect();
      window.removeEventListener("resize", medir);
      mapa.current?.remove();
      mapa.current = null;
    };
  }, []);

  return (
    <section ref={seccion} className={`mapa-visita${listo ? " is-listo" : ""}`} id="visita" aria-labelledby="visita-titulo">
      <div className="mapa-visita__fondo" aria-hidden="true" />
      <div ref={lienzo} className="mapa-visita__lienzo" role="region" aria-label="Mapa: Plaza 25 de Mayo, Sucre" />
      <div className="wrap mapa-visita__wrap">
        <div className="mapa-visita__tarjeta" data-revelar>
          <p className="eyebrow">Te esperamos</p>
          <h2 id="visita-titulo">Visítanos en Sucre</h2>
          <p className="mapa-visita__lugar">
            <strong>Plaza 25 de Mayo</strong>
            <span>Centro histórico, Sucre · Bolivia</span>
          </p>
          {/* Horario supuesto: reemplazar por el horario real del negocio. */}
          <dl className="hours" data-assumed>
            <dt>Lunes a viernes</dt>
            <dd>8:00 a 20:30</dd>
            <dt>Sábado</dt>
            <dd>9:00 a 20:30</dd>
            <dt>Domingo</dt>
            <dd>Cerrado</dd>
          </dl>
          <div className="mapa-visita__botones">
            <a href={COMO_LLEGAR} className="btn btn--primary" target="_blank" rel="noreferrer">Cómo llegar</a>
            <a href={WHATSAPP} className="btn btn--secondary" target="_blank" rel="noreferrer">WhatsApp</a>
          </div>
        </div>
      </div>
    </section>
  );
}
