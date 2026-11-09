/* eslint-disable @next/next/no-img-element -- export estático: next/image no optimiza aquí */
import Link from "next/link";
import TazaPie from "./TazaPie";
import Contacto from "./Contacto";

/**
 * Secciones compartidas de las páginas públicas (proceso, visita y pie).
 *
 * Imágenes: el local, "grano verde", "enfriado", las bolsas, los paisajes de origen, Sucre y
 * todos los videos se generaron con Kling AI;
 * "tueste" y "tu taza" son fotografías de Wikimedia Commons con licencia libre (créditos en el pie).
 */

const PROCESO = [
  {
    img: "/images/home/verde-kling.webp",
    alt: "Un saco abierto lleno de granos de café verde con una cuchara de metal",
    titulo: "Grano verde",
    texto: "Llega en sacos desde la finca. Lo pesamos y lo registramos con su origen y su fecha de llegada.",
  },
  {
    img: "/images/home/tueste.webp",
    alt: "El muestreador de una tostadora con granos a medio tostar",
    titulo: "Tueste",
    texto: "Tostamos por lotes pequeños y sacamos muestras para seguir el color del grano en cada minuto.",
  },
  {
    img: "/images/home/enfriado-kling.webp",
    alt: "Granos recién tostados en la bandeja de enfriado de la tostadora",
    titulo: "Enfriado",
    texto: "El grano baja a temperatura ambiente en la bandeja y reposa antes de entrar en su bolsa.",
  },
  {
    img: "/images/home/pourover.webp",
    alt: "Agua caliente vertida desde una tetera sobre un filtro de café",
    titulo: "Tu taza",
    texto: "Cada bolsa lleva el código de su lote, así sabes de qué finca y de qué tueste viene tu café.",
  },
];

/** El proceso del tueste en 4 pasos. En el Inicio lleva un enlace a la página Nosotros. */
export function Proceso({ conEnlace = false }: { conEnlace?: boolean }) {
  return (
    <section className="section" id="tueste" aria-labelledby="tueste-titulo">
      <div className="wrap">
        <div className="head" data-revelar>
          <h2 id="tueste-titulo">Del grano verde a tu taza</h2>
          <div>
            <p>El mismo lote se sigue desde que llega en saco hasta que sale en bolsa con su código.</p>
            {conEnlace && (
              <Link href="/nosotros" className="link head__link">
                Conoce nuestra historia →
              </Link>
            )}
          </div>
        </div>
        <ol className="process" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {PROCESO.map((p, i) => (
            <li key={p.titulo} className="process__item" data-revelar style={{ "--i": i } as React.CSSProperties}>
              <figure>
                <img src={p.img} alt={p.alt} loading="lazy" decoding="async" />
              </figure>
              <h3>{p.titulo}</h3>
              <p>{p.texto}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const MAPA = "https://www.openstreetmap.org/search?query=Centro%20hist%C3%B3rico%2C%20Sucre%2C%20Bolivia";

export function Visita() {
  return (
    <section className="section" id="visita" aria-labelledby="visita-titulo">
      <div className="wrap visit">
        <div className="visit__panel" data-revelar>
          <h2 id="visita-titulo">Visítanos en Sucre</h2>
          <p className="visit__place">
            <a href={MAPA} className="link" target="_blank" rel="noreferrer">
              Centro histórico, Sucre
            </a>
          </p>
          <p className="visit__note">Cafetería y tostaduría en el mismo local.</p>
          {/* Horario supuesto: reemplazar por el horario real del negocio. */}
          <dl className="hours" data-assumed>
            <dt>Lunes a viernes</dt>
            <dd>8:00 a 20:30</dd>
            <dt>Sábado</dt>
            <dd>9:00 a 20:30</dd>
            <dt>Domingo</dt>
            <dd>Cerrado</dd>
          </dl>
          <a href={MAPA} className="btn btn--secondary" target="_blank" rel="noreferrer">
            Ver la zona en el mapa
          </a>
        </div>
        <figure className="visit__photo" data-revelar style={{ "--i": 1 } as React.CSSProperties}>
          <img
            src="/images/home/local.webp"
            alt="La barra del local: máquina de espresso, molinos y bolsas de café en repisas bajo vigas de madera"
            loading="lazy"
            decoding="async"
          />
        </figure>
      </div>
    </section>
  );
}

const CREDITOS = [
  { que: "Tueste", autor: "Jameswasswa", lic: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Closer_look_at_the_coffee_beans_from_the_coffee_roasting_machine_looking_at_their_progress.jpg" },
  { que: "Tu taza", autor: "Kim Sanso", lic: "CC0", url: "https://commons.wikimedia.org/wiki/File:Manual_drip_(pour-over)_coffee.jpg" },
];

export function PieInicio() {
  return (
    <footer className="foot">
      <TazaPie>
        <h2 className="foot__title">Del tostador a tu taza</h2>
        <p className="foot__line">
          Cafés de origen boliviano, tostados por lote en Sucre y enviados a tu casa.
        </p>
        <Link href="/tienda" className="btn btn--light">
          Comprar café
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </Link>
      </TazaPie>
      <Contacto />
      <div className="wrap foot__bottom">
        <div className="foot__cols">
          <div>
            <h3>Visita</h3>
            <p>
              <a href={MAPA} className="link" target="_blank" rel="noreferrer">
                Centro histórico, Sucre
              </a>
            </p>
            <p>Cafetería y tostaduría</p>
          </div>
          <div>
            <h3>Tienda</h3>
            <ul>
              <li><Link href="/tienda" className="link">Cafés de origen</Link></li>
              <li><Link href="/nosotros" className="link">Nosotros</Link></li>
              <li><Link href="/club" className="link">Club Grano y Aroma</Link></li>
              <li><Link href="/subastas" className="link">Subastas de micro-lotes</Link></li>
            </ul>
          </div>
          <div>
            <h3>Equipo</h3>
            <ul>
              <li><Link href="/pos" className="link">Caja</Link></li>
              <li><Link href="/erp" className="link">Bodega y tueste</Link></li>
              <li><Link href="/admin" className="link">Administración</Link></li>
            </ul>
          </div>
        </div>
        <div className="foot__legal">
          <span>© 2026 Grano y Aroma · Proyecto de Ingeniería de Software, USFX</span>
          <details className="credits">
            <summary>Imágenes generadas con Kling AI y fotografías vía Wikimedia Commons</summary>
            <ul>
              {CREDITOS.map((c) => (
                <li key={c.que}>
                  <a href={c.url} target="_blank" rel="noreferrer">
                    {c.que}: {c.autor}, {c.lic}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </div>
    </footer>
  );
}
