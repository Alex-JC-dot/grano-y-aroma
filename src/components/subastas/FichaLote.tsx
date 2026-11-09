"use client";

/* eslint-disable @next/next/no-img-element -- export estático: next/image no optimiza aquí */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuctionStore } from "@/store/auctionStore";
import { useAuth } from "@/store/authStore";
import { formatBs, formatTimeLeft } from "@/lib/utils";
import type { Auction } from "@/lib/types";

/**
 * Ficha de un lote en subasta: /subastas/lote?l=<id>.
 * Puja en vivo (misma regla: Bs. 20 sobre la actual), rueda de catación, historia del lote,
 * gráfica de cómo subió el precio e historial completo de pujas. Los atributos de catación y
 * la historia son datos de demostración del lote.
 */

const INCREMENTO = 20;

const EXTRA: Record<string, {
  img: string;
  alt: string;
  variedad: string;
  proceso: string;
  cosecha: string;
  finca: string;
  historia: string;
  catacion: [string, number][];
}> = {
  a1: {
    img: "/images/subastas/gesha.webp",
    alt: "Rama de cafeto con cerezas rojas maduras sobre un valle al amanecer",
    variedad: "Gesha",
    proceso: "Natural",
    cosecha: "Junio de 2025",
    finca: "Finca familiar en Villa Serrano",
    historia:
      "Un pequeño grupo de plantas de Gesha cultivadas a 1.920 msnm. Las cerezas se secan enteras sobre camas elevadas durante cuatro semanas, lo que da su perfil floral y a frutas blancas.",
    catacion: [["Aroma", 9.0], ["Sabor", 9.0], ["Acidez", 8.75], ["Cuerpo", 8.25], ["Dulzor", 9.0], ["Final", 8.75]],
  },
  a2: {
    img: "/images/subastas/bourbon.webp",
    alt: "Cerezas de café secándose al sol en camas elevadas",
    variedad: "Bourbon",
    proceso: "Natural, doble fermentación aeróbica",
    cosecha: "Mayo de 2025",
    finca: "Familia Veizaga, Padilla",
    historia:
      "La familia Veizaga fermenta las cerezas dos veces antes de secarlas al sol. Es su primer lote en subasta, de producción limitada de la temporada 2025.",
    catacion: [["Aroma", 8.5], ["Sabor", 8.5], ["Acidez", 8.0], ["Cuerpo", 8.75], ["Dulzor", 8.75], ["Final", 8.25]],
  },
  a3: {
    img: "/images/subastas/reserva.webp",
    alt: "Muestra de café verde en una bandeja de madera junto a una lupa",
    variedad: "Caturra y Typica",
    proceso: "Natural",
    cosecha: "Junio de 2025",
    finca: "Productores de Villa Serrano",
    historia:
      "Selección de los mejores sacos del lote Natural 001, separada en la mesa de catación para esta subasta. Taza limpia, dulce y con acidez cítrica.",
    catacion: [["Aroma", 8.75], ["Sabor", 8.5], ["Acidez", 8.5], ["Cuerpo", 8.25], ["Dulzor", 8.75], ["Final", 8.5]],
  },
};

export default function FichaLote() {
  const id = useSearchParams().get("l");
  const lote = useAuctionStore((s) => s.auctions.find((a) => a.id === id));
  const tick = useAuctionStore((s) => s.tickTimers);

  useEffect(() => {
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [tick]);

  if (!lote || !EXTRA[lote.id]) {
    return (
      <section className="section page-top">
        <div className="wrap">
          <h1 className="ficha__titulo">No encontramos ese lote</h1>
          <p>Puede que la subasta ya no esté publicada.</p>
          <Link href="/subastas" className="btn btn--primary">Ver las subastas</Link>
        </div>
      </section>
    );
  }
  return <Lote key={lote.id} lote={lote} />;
}

function Lote({ lote }: { lote: Auction }) {
  const placeBid = useAuctionStore((s) => s.placeBid);
  const x = EXTRA[lote.id];
  const [monto, setMonto] = useState("");
  const [aviso, setAviso] = useState<{ texto: string; error: boolean } | null>(null);
  const cerrada = lote.timeLeftSeconds === 0;
  const minimo = lote.bids.length ? lote.currentBid + INCREMENTO : lote.basePrice;

  useEffect(() => {
    document.title = `${lote.productName} · Subastas · Grano y Aroma`;
  }, [lote.productName]);

  const pedirCuenta = useAuth((s) => s.pedirCuenta);
  const pujar = async (e: React.FormEvent) => {
    e.preventDefault();
    const m = Number(monto);
    if (!m || m < minimo) return setAviso({ texto: `Escribe al menos ${formatBs(minimo)}.`, error: true });
    if (!(await pedirCuenta("Para pujar necesitas una cuenta. Tu monto se mantiene."))) return;
    if (placeBid(lote.id, "Tú", m)) {
      setAviso({ texto: `Tu puja de ${formatBs(m)} va primera.`, error: false });
      setMonto("");
    }
  };

  return (
    <>
      <section className="section page-top" aria-labelledby="lote-titulo">
        <div className="wrap">
          <nav className="migas" aria-label="Estás en">
            <Link href="/subastas" className="link">Subastas</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{lote.productName.split(" — ")[0]}</span>
          </nav>

          <div className="ficha">
            <div className="ficha__visual">
              <figure className="lote-ficha__foto">
                <img src={x.img} alt={x.alt} />
                <span className={`lote__reloj${!cerrada && lote.timeLeftSeconds < 3600 ? " is-urgente" : ""}`}>
                  {cerrada ? "Cerrada" : `Cierra en ${formatTimeLeft(lote.timeLeftSeconds)}`}
                </span>
              </figure>
            </div>

            <div className="ficha__info">
              <p className="ficha__origen">{lote.origin} · {lote.altitude.toLocaleString("es-BO")} msnm · {lote.quantity} {lote.unit}</p>
              <h1 id="lote-titulo" className="ficha__titulo">{lote.productName}</h1>
              <p className="ficha__notas">{lote.description}</p>

              <div className="ficha__compra lote-ficha__puja">
                <div className="lote-ficha__actual">
                  <span className="lote__etiqueta">{lote.bids.length ? "Puja actual" : "Precio de salida"}</span>
                  <span className="ficha__precio">{formatBs(lote.bids.length ? lote.currentBid : lote.basePrice)}</span>
                  <span className="lote__etiqueta">
                    {lote.bids.length === 1 ? "1 puja" : `${lote.bids.length} pujas`}
                    {lote.currentBidder && ` · va primero ${lote.currentBidder}`}
                  </span>
                </div>
                {!cerrada ? (
                  <form className="lote__form" onSubmit={pujar} noValidate>
                    <label htmlFor="puja-ficha">Tu puja en Bs. (mínimo {minimo})</label>
                    <div className="lote__fila">
                      <input
                        id="puja-ficha"
                        type="number"
                        inputMode="numeric"
                        min={minimo}
                        step={10}
                        value={monto}
                        placeholder={String(minimo)}
                        onChange={(e) => setMonto(e.target.value)}
                        aria-invalid={aviso?.error || undefined}
                        aria-describedby="puja-ficha-aviso"
                      />
                      <button type="submit" className="btn btn--primary">Pujar</button>
                    </div>
                    <p id="puja-ficha-aviso" className={`lote__aviso${aviso?.error ? " is-error" : ""}`} role="status">{aviso?.texto}</p>
                  </form>
                ) : (
                  <p className="lote__resultado">
                    {lote.currentBidder ? `Ganó ${lote.currentBidder} con ${formatBs(lote.currentBid)}.` : "Cerró sin pujas."}
                  </p>
                )}
              </div>

              <h2 className="ficha__subtitulo">El lote</h2>
              <dl className="ficha__datos">
                <dt>Finca</dt><dd>{x.finca}</dd>
                <dt>Variedad</dt><dd>{x.variedad}</dd>
                <dt>Proceso</dt><dd>{x.proceso}</dd>
                <dt>Cosecha</dt><dd>{x.cosecha}</dd>
                <dt>Código</dt><dd>{lote.lotCode}</dd>
                <dt>Puntaje de catación</dt><dd>{lote.cuppingScore.toLocaleString("es-BO", { minimumFractionDigits: 1 })} puntos</dd>
              </dl>
            </div>
          </div>
        </div>
      </section>

      <section className="section section--tight" aria-labelledby="catacion-titulo">
        <div className="wrap">
          <div className="head" data-revelar>
            <h2 id="catacion-titulo">Cómo sabe en la taza</h2>
            <div><p>{x.historia}</p></div>
          </div>
          <div className="lote-graficos">
            <figure className="lote-grafico desde-izq" data-revelar>
              <figcaption>Rueda de catación</figcaption>
              <Rueda atributos={x.catacion} />
            </figure>
            <figure className="lote-grafico desde-der" data-revelar>
              <figcaption>Cómo subió el precio</figcaption>
              <Pujas lote={lote} />
            </figure>
          </div>
        </div>
      </section>

      <section className="section section--tight" aria-labelledby="historial-titulo">
        <div className="wrap">
          <div className="head">
            <h2 id="historial-titulo">Todas las pujas</h2>
          </div>
          {lote.bids.length ? (
            <div className="tabla-pujas">
              <table>
                <thead>
                  <tr><th scope="col">Postor</th><th scope="col" className="num">Monto</th><th scope="col" className="num">Hora</th></tr>
                </thead>
                <tbody>
                  {lote.bids.map((b, i) => (
                    <tr key={i} className={i === 0 ? "is-primera" : ""}>
                      <td>{b.bidder}{i === 0 && <small> · va primero</small>}</td>
                      <td className="num">{formatBs(b.amount)}</td>
                      <td className="num">{b.timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="filtros__vacio">Todavía no hay pujas: la primera puede ser la tuya.</p>
          )}
          <p className="caja__sub" style={{ marginTop: 24 }}>
            <Link href="/subastas" className="link">← Volver a las subastas</Link>
          </p>
        </div>
      </section>
    </>
  );
}

/** Rueda (radar) de catación: 6 atributos en escala de 6 a 10. Se dibuja al aparecer. */
function Rueda({ atributos }: { atributos: [string, number][] }) {
  const C = 170;
  const R = 120;
  const n = atributos.length;
  const punto = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    const r = (R * (v - 6)) / 4;
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
  };
  const poligono = atributos.map(([, v], i) => punto(i, v).map((z) => z.toFixed(1)).join(",")).join(" ");
  return (
    <svg viewBox="0 0 340 340" className="rueda" role="img" aria-label={`Atributos: ${atributos.map(([k, v]) => `${k} ${v}`).join(", ")}`}>
      {[7, 8, 9, 10].map((v) => (
        <polygon key={v} className="rueda__anillo" points={atributos.map((_, i) => punto(i, v).join(",")).join(" ")} />
      ))}
      {atributos.map((_, i) => {
        const [x2, y2] = punto(i, 10);
        return <line key={i} x1={C} y1={C} x2={x2} y2={y2} className="rueda__eje" />;
      })}
      <polygon points={poligono} className="rueda__area" />
      {atributos.map(([k, v], i) => {
        const [px, py] = punto(i, v);
        const [lx, ly] = punto(i, 10.9);
        return (
          <g key={k}>
            <circle cx={px} cy={py} r={4} className="rueda__punto" />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className="rueda__texto">
              {k} <tspan className="rueda__valor">{v.toLocaleString("es-BO")}</tspan>
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Gráfica escalonada del precio del lote, desde la salida hasta la puja actual. */
function Pujas({ lote }: { lote: Auction }) {
  const serie = [lote.basePrice, ...[...lote.bids].reverse().map((b) => b.amount)];
  const W = 460;
  const H = 300;
  const m = { izq: 64, der: 16, arr: 20, aba: 36 };
  const min = Math.min(...serie) * 0.95;
  const max = Math.max(...serie) * 1.05;
  const x = (i: number) => m.izq + (i / Math.max(1, serie.length - 1)) * (W - m.izq - m.der);
  const y = (v: number) => m.arr + (1 - (v - min) / (max - min)) * (H - m.arr - m.aba);
  let d = `M${x(0)} ${y(serie[0])}`;
  serie.slice(1).forEach((v, i) => (d += ` H${x(i + 1)} V${y(v)}`));
  const marcas = [min, (min + max) / 2, max].map((v) => Math.round(v / 10) * 10);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pujas-grafico" role="img" aria-label={`El precio subió de ${formatBs(serie[0])} a ${formatBs(serie[serie.length - 1])} en ${serie.length - 1} pujas`}>
      {marcas.map((v) => (
        <g key={v}>
          <line x1={m.izq} x2={W - m.der} y1={y(v)} y2={y(v)} className="curva__guia" />
          <text x={m.izq - 8} y={y(v) + 4} textAnchor="end" className="curva__eje">{v}</text>
        </g>
      ))}
      <text x={x(0)} y={H - 10} className="curva__eje">Salida</text>
      <text x={x(serie.length - 1)} y={H - 10} textAnchor="end" className="curva__eje">{serie.length > 1 ? "Ahora" : ""}</text>
      <path d={d} pathLength={1} className="pujas-grafico__linea" />
      {serie.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={i === serie.length - 1 ? 6 : 4} className="pujas-grafico__punto" />
      ))}
    </svg>
  );
}
