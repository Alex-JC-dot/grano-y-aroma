"use client";

/* eslint-disable @next/next/no-img-element -- export estático: next/image no optimiza aquí */
import { useEffect, useState } from "react";
import { useAuctionStore } from "@/store/auctionStore";
import { formatBs, formatTimeLeft } from "@/lib/utils";

/**
 * Subastas de micro-lotes (RF-10 a RF-16), con la misma lógica del prototipo: cuenta regresiva,
 * puja mínima de Bs. 20 sobre la actual, historial y ganador al cerrar. Hoy las pujas viven en
 * el navegador (auctionStore); con Supabase serán en tiempo real para todos los postores.
 */

const INCREMENTO = 20;

// Una imagen distinta por lote (provisionales hasta tener fotos de cada micro-lote).
const IMAGENES: Record<string, { src: string; alt: string }> = {
  a1: { src: "/images/home/microlote.webp", alt: "Granos de café verde derramados de un saco de yute" },
  a2: { src: "/images/home/verde-kling.webp", alt: "Saco abierto con granos de café verde y una cuchara" },
  a3: { src: "/images/home/tueste.webp", alt: "Muestra de granos en el muestreador de una tostadora" },
};

export default function Subastas() {
  const { auctions, placeBid, tickTimers } = useAuctionStore();
  const [montos, setMontos] = useState<Record<string, string>>({});
  const [avisos, setAvisos] = useState<Record<string, { texto: string; error: boolean }>>({});

  useEffect(() => {
    const id = setInterval(tickTimers, 1000);
    return () => clearInterval(id);
  }, [tickTimers]);

  const pujar = (id: string) => {
    const lote = auctions.find((a) => a.id === id);
    if (!lote) return;
    const minimo = lote.bids.length ? lote.currentBid + INCREMENTO : lote.basePrice;
    const monto = Number(montos[id]);
    if (!monto || monto < minimo) {
      setAvisos((a) => ({ ...a, [id]: { texto: `Escribe al menos ${formatBs(minimo)}.`, error: true } }));
      return;
    }
    if (placeBid(id, "Tú", monto)) {
      setAvisos((a) => ({ ...a, [id]: { texto: `Tu puja de ${formatBs(monto)} va primera.`, error: false } }));
      setMontos((m) => ({ ...m, [id]: "" }));
    }
  };

  return (
    <>
      <section className="section page-top" aria-labelledby="subastas-titulo">
        <div className="wrap">
          <div className="head" data-revelar>
            <div className="head__titulo">
              <p className="eyebrow"><span className="en-vivo" aria-hidden="true" /> Subastas en vivo</p>
              <h1 id="subastas-titulo">Micro-lotes de Chuquisaca</h1>
            </div>
            <div>
              <p>
                Lotes de producción limitada, directo de las fincas. Cada puja debe superar a la anterior
                en al menos {formatBs(INCREMENTO)}; la subasta se cierra sola y gana la puja más alta.
              </p>
            </div>
          </div>

          <div className="lotes">
            {auctions.map((a, i) => {
              const cerrada = a.timeLeftSeconds === 0;
              const urgente = !cerrada && a.timeLeftSeconds < 3600;
              const minimo = a.bids.length ? a.currentBid + INCREMENTO : a.basePrice;
              const img = IMAGENES[a.id];
              const aviso = avisos[a.id];
              const campo = `puja-${a.id}`;

              return (
                <article key={a.id} className={`lote${cerrada ? " is-cerrada" : ""}`} data-revelar style={{ "--i": i } as React.CSSProperties}>
                  <div className="lote__visual">
                    {img && <img src={img.src} alt={img.alt} loading="lazy" decoding="async" />}
                    <span className={`lote__reloj${urgente ? " is-urgente" : ""}`}>
                      {cerrada ? "Cerrada" : `Cierra en ${formatTimeLeft(a.timeLeftSeconds)}`}
                    </span>
                  </div>

                  <div className="lote__cuerpo">
                    <p className="lote__origen">
                      {a.origin} · {a.altitude.toLocaleString("es-BO")} msnm · {a.quantity} {a.unit}
                    </p>
                    <h2 className="lote__titulo">{a.productName}</h2>
                    <p className="lote__desc">{a.description}</p>

                    <div className="lote__puja">
                      <div>
                        <span className="lote__etiqueta">{a.bids.length ? "Puja actual" : "Precio de salida"}</span>
                        <span className="lote__monto">{formatBs(a.bids.length ? a.currentBid : a.basePrice)}</span>
                      </div>
                      <div className="lote__lider">
                        <span className="lote__etiqueta">{a.bids.length === 1 ? "1 puja" : `${a.bids.length} pujas`} · {a.cuppingScore.toLocaleString("es-BO", { minimumFractionDigits: 1 })} puntos</span>
                        {a.currentBidder && <span>Va primero: {a.currentBidder}</span>}
                      </div>
                    </div>

                    {a.bids.length > 0 && (
                      <ol className="lote__historial" aria-label="Últimas pujas">
                        {a.bids.slice(0, 3).map((b, j) => (
                          <li key={j}>
                            <span>{b.bidder}</span>
                            <span>{formatBs(b.amount)}</span>
                            <span className="lote__hora">{b.timestamp}</span>
                          </li>
                        ))}
                      </ol>
                    )}

                    {!cerrada ? (
                      <form
                        className="lote__form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          pujar(a.id);
                        }}
                        noValidate
                      >
                        <label htmlFor={campo}>Tu puja en Bs. (mínimo {minimo})</label>
                        <div className="lote__fila">
                          <input
                            id={campo}
                            type="number"
                            inputMode="numeric"
                            min={minimo}
                            step={10}
                            value={montos[a.id] ?? ""}
                            onChange={(e) => setMontos((m) => ({ ...m, [a.id]: e.target.value }))}
                            aria-invalid={aviso?.error || undefined}
                            aria-describedby={`${campo}-aviso`}
                            placeholder={String(minimo)}
                          />
                          <button type="submit" className="btn btn--primary">Pujar</button>
                        </div>
                        <p id={`${campo}-aviso`} className={`lote__aviso${aviso?.error ? " is-error" : ""}`} role="status">
                          {aviso?.texto}
                        </p>
                      </form>
                    ) : (
                      <p className="lote__resultado">
                        {a.currentBidder ? `Ganó ${a.currentBidder} con ${formatBs(a.currentBid)}.` : "Cerró sin pujas: el lote no se adjudicó."}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
