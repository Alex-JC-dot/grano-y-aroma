"use client";

/* eslint-disable @next/next/no-img-element -- export estático: next/image no optimiza aquí */
import Link from "next/link";
import { useState } from "react";
import { cafes as TODOS_LOS_CAFES } from "@/lib/catalogo";
import { formatBs } from "@/lib/utils";
import { rutaCafe } from "@/lib/catalogo";

/**
 * Mapa de orígenes: Bolivia dibujada en SVG con un punto por cada origen y por la tostaduría
 * en Sucre. Al tocar un punto se muestra su paisaje (fotos de Kling) y los cafés de ese lugar.
 * Las rutas hacia Sucre se dibujan al aparecer la sección (RevelarAlScroll).
 */

// Proyección simple (equirectangular) de longitud/latitud al viewBox 0 0 520 550.
const p = (lon: number, lat: number) => [((lon + 70) * 40).toFixed(1), ((-lat - 9.5) * 40).toFixed(1)];

// Contorno aproximado de Bolivia (longitud, latitud).
const CONTORNO: [number, number][] = [
  [-69.57, -10.95], [-68.7, -11.0], [-68.3, -10.95], [-67.7, -10.65], [-66.6, -9.9], [-65.4, -9.7],
  [-65.3, -10.5], [-65.0, -11.6], [-64.4, -12.45], [-63.4, -12.6], [-62.8, -13.0], [-62.1, -13.2],
  [-61.8, -13.5], [-61.0, -13.55], [-60.4, -13.95], [-60.25, -15.1], [-60.55, -15.1], [-60.2, -16.25],
  [-58.4, -16.3], [-58.3, -17.3], [-57.75, -17.55], [-57.6, -18.2], [-57.5, -19.0], [-58.15, -19.8],
  [-58.15, -20.15], [-59.1, -19.35], [-60.0, -19.3], [-61.75, -19.65], [-62.25, -20.5], [-62.3, -21.05],
  [-62.65, -22.25], [-63.0, -22.0], [-64.0, -21.95], [-64.4, -22.75], [-65.0, -22.1], [-66.3, -21.8],
  [-66.75, -22.4], [-67.1, -22.75], [-67.85, -22.85], [-68.2, -21.3], [-68.75, -20.4], [-68.45, -19.4],
  [-69.0, -19.0], [-69.1, -18.3], [-69.6, -17.6], [-69.1, -16.75], [-69.4, -15.6], [-69.2, -15.25],
  [-69.35, -14.75], [-68.95, -14.2], [-68.85, -12.9], [-68.7, -12.5],
];
const CONTORNO_D = "M" + CONTORNO.map(([lon, lat]) => p(lon, lat).join(" ")).join(" L") + " Z";

type Origen = {
  id: string;
  nombre: string;
  zona: string;
  // Posición en el mapa (ligeramente separada de la real cuando dos puntos se encimarían).
  lon: number;
  lat: number;
  etiqueta: "izq" | "der";
  foto: string;
  alt: string;
  texto: string;
  region?: string; // texto con el que se buscan sus cafés en product.region
};

const SUCRE: Origen = {
  id: "sucre",
  nombre: "Sucre",
  zona: "Tostaduría · Chuquisaca",
  lon: -65.26,
  lat: -19.05,
  etiqueta: "izq",
  foto: "/images/origen/sucre.webp",
  alt: "Techos de tejas y fachadas blancas de Sucre frente a los cerros al atardecer",
  texto: "Aquí llega todo el grano verde. Lo tostamos por lote y lo enviamos desde el centro histórico.",
};

const ORIGENES: Origen[] = [
  {
    id: "caranavi",
    nombre: "Caranavi",
    zona: "Yungas · La Paz",
    lon: -67.4,
    lat: -15.65,
    etiqueta: "der",
    foto: "/images/origen/caranavi.webp",
    alt: "Valle de los Yungas con neblina y una ladera con plantas de café",
    texto: "Valles húmedos de los Yungas, la zona cafetalera más grande de Bolivia.",
    region: "Caranavi",
  },
  {
    id: "coroico",
    nombre: "Coroico",
    zona: "Yungas · La Paz",
    lon: -67.85,
    lat: -16.35,
    etiqueta: "izq",
    foto: "/images/origen/coroico.webp",
    alt: "Cerros verdes de los Yungas con neblina en el valle, al amanecer",
    texto: "Cerros empinados y neblina de montaña en los Yungas de La Paz.",
    region: "Coroico",
  },
  {
    id: "villa-serrano",
    nombre: "Villa Serrano",
    zona: "Valles · Chuquisaca",
    lon: -64.4,
    lat: -18.85,
    etiqueta: "der",
    foto: "/images/origen/chuquisaca.webp",
    alt: "Valles de Chuquisaca con una rama de cafeto con cerezas rojas",
    texto: "Valles interandinos de Chuquisaca, el origen de nuestros lotes de mayor puntaje.",
    region: "Villa Serrano",
  },
  {
    id: "padilla",
    nombre: "Padilla",
    zona: "Valles · Chuquisaca",
    lon: -64.15,
    lat: -19.5,
    etiqueta: "der",
    foto: "/images/origen/chuquisaca.webp",
    alt: "Valles de Chuquisaca con una rama de cafeto con cerezas rojas",
    texto: "Provincia Tomina, en los valles de Chuquisaca, cerca de nuestra tostaduría.",
    region: "Padilla",
  },
];

const TODOS = [...ORIGENES, SUCRE];

const REGIONES = [
  {
    id: "yungas",
    nombre: "Yungas, La Paz",
    detalle: "Caranavi y Coroico · 1.400 a 1.600 msnm",
    foto: "/images/origen/coroico.webp",
    alt: "Cerros verdes de los Yungas con neblina en el valle, al amanecer",
    origenes: ["caranavi", "coroico"],
  },
  {
    id: "chuquisaca",
    nombre: "Valles de Chuquisaca",
    detalle: "Villa Serrano y Padilla · 1.680 a 1.920 msnm",
    foto: "/images/origen/chuquisaca.webp",
    alt: "Valles de Chuquisaca con una rama de cafeto con cerezas rojas",
    origenes: ["villa-serrano", "padilla"],
  },
];
const [SX, SY] = p(SUCRE.lon, SUCRE.lat).map(Number);

// Ruta curva de un origen a Sucre.
function ruta(o: Origen) {
  const [x, y] = p(o.lon, o.lat).map(Number);
  const cx = (x + SX) / 2 + (y - SY) * 0.25;
  const cy = (y + SY) / 2 - (x - SX) * 0.25;
  return `M${x} ${y} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${SX} ${SY}`;
}

/** `conRegiones`: muestra las fotos de las dos regiones bajo el mapa (en Nosotros, no en el Inicio). */
export default function MapaOrigenes({ conRegiones = false }: { conRegiones?: boolean }) {
  const [elegido, setElegido] = useState("villa-serrano");
  const o = TODOS.find((x) => x.id === elegido)!;
  const cafes = o.region ? TODOS_LOS_CAFES.filter((c) => c.region.includes(o.region!)) : [];
  const alturas = cafes.map((c) => c.altitude);

  return (
    <section className="section" id="origenes" aria-labelledby="origenes-titulo">
      <div className="wrap">
        <div className="head" data-revelar>
          <h2 id="origenes-titulo">{TODOS_LOS_CAFES.length} cafés, cuatro orígenes</h2>
          <div>
            <p>Toca un punto del mapa para ver de dónde viene cada café y cómo es ese lugar.</p>
          </div>
        </div>

        <div className="mapa" data-revelar>
          <div className="mapa__lienzo">
            <div className="mapa__area">
            <svg viewBox="0 0 520 550" className="mapa__svg" aria-hidden="true">
              <path d={CONTORNO_D} className="mapa__pais" />
              {ORIGENES.map((x, i) => (
                <path
                  key={x.id}
                  d={ruta(x)}
                  pathLength={1}
                  className={`mapa__ruta${x.id === elegido ? " is-on" : ""}`}
                  style={{ "--i": i } as React.CSSProperties}
                />
              ))}
            </svg>
            {TODOS.map((x) => {
              const [px, py] = p(x.lon, x.lat).map(Number);
              return (
                <button
                  key={x.id}
                  type="button"
                  className={`mapa__punto mapa__punto--${x.etiqueta}${x.id === "sucre" ? " mapa__punto--sucre" : ""}${x.id === elegido ? " is-on" : ""}`}
                  style={{ left: `${(px / 520) * 100}%`, top: `${(py / 550) * 100}%` }}
                  aria-pressed={x.id === elegido}
                  onClick={() => setElegido(x.id)}
                >
                  <span className="mapa__marca" aria-hidden="true" />
                  <span className="mapa__nombre">{x.nombre}</span>
                </button>
              );
            })}
            </div>
            <p className="mapa__leyenda">
              <span className="mapa__marca" aria-hidden="true" /> Origen
              <span className="mapa__marca mapa__marca--sucre" aria-hidden="true" /> Tostaduría
            </p>
          </div>

          <div className="mapa__panel" aria-live="polite">
            <figure className="mapa__foto">
              <img key={o.foto} src={o.foto} alt={o.alt} loading="lazy" decoding="async" />
            </figure>
            <p className="mapa__zona">{o.zona}</p>
            <h3 className="mapa__titulo">{o.nombre}</h3>
            <p className="mapa__texto">{o.texto}</p>
            {cafes.length > 0 ? (
              <>
                <p className="mapa__altura">
                  {Math.min(...alturas).toLocaleString("es-BO")}
                  {Math.max(...alturas) !== Math.min(...alturas) && ` a ${Math.max(...alturas).toLocaleString("es-BO")}`} msnm
                </p>
                <ul className="mapa__cafes">
                  {cafes.map((c) => (
                    <li key={c.id}>
                      <Link href={rutaCafe(c)} className="link">
                        {c.name}
                      </Link>
                      <span>{formatBs(c.price)}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <Link href="/nosotros" className="link mapa__mas">
                Conoce la tostaduría →
              </Link>
            )}
          </div>
        </div>

        {/* Las dos regiones de origen, lado a lado: al tocar una, el mapa salta a ese origen */}
        {conRegiones && (
        <div className="regiones" data-revelar>
          {REGIONES.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`region${r.origenes.includes(elegido) ? " is-on" : ""}`}
              onClick={() => setElegido(r.origenes[0])}
            >
              <img src={r.foto} alt={r.alt} loading="lazy" decoding="async" />
              <span className="region__texto">
                <span className="region__nombre">{r.nombre}</span>
                <span className="region__detalle">{r.detalle}</span>
              </span>
            </button>
          ))}
        </div>
        )}
      </div>
    </section>
  );
}
