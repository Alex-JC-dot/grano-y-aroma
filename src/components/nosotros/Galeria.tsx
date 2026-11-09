/* eslint-disable @next/next/no-img-element -- export estático: next/image no optimiza aquí */

/** Nosotros: la cafetería por dentro (fotos generadas con Kling). */
const FOTOS = [
  { src: "/images/local/barra.webp", alt: "La barra de la cafetería con molinos y máquina de espresso, a la luz de la mañana", clase: "galeria__foto--ancha" },
  { src: "/images/local/mesas.webp", alt: "Mesas de madera con tazas de café junto a una ventana alta", clase: "" },
  { src: "/images/local/ventana.webp", alt: "Un capuchino con arte latte en el marco de una ventana, con tejados coloniales afuera", clase: "" },
];

export default function Galeria() {
  return (
    <section className="section" id="cafeteria" aria-labelledby="cafeteria-titulo">
      <div className="wrap">
        <div className="head" data-revelar>
          <h2 id="cafeteria-titulo">La cafetería por dentro</h2>
          <div>
            <p>Muros blancos, vigas de madera y la barra donde servimos los mismos cafés que tostamos.</p>
          </div>
        </div>
        <div className="galeria">
          {FOTOS.map((f, i) => (
            <figure key={f.src} className={`galeria__foto ${f.clase}`} data-revelar style={{ "--i": i } as React.CSSProperties}>
              <img src={f.src} alt={f.alt} loading="lazy" decoding="async" />
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
