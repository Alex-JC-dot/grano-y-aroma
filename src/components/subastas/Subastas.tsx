"use client";

/* eslint-disable @next/next/no-img-element -- export estático: next/image no optimiza aquí */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Cerradas, ComoFunciona, Pestanas, Proximas, type Pestana } from "./SubastasExtra";
import { useAuctionStore } from "@/store/auctionStore";
import { formatBs, formatTimeLeft } from "@/lib/utils";
import VideoUnaVez from "@/components/inicio/VideoUnaVez";
import { useAuth } from "@/store/authStore";

/**
 * Subastas de micro-lotes (RF-10 a RF-16), con la misma lógica del prototipo: cuenta regresiva,
 * puja mínima de Bs. 20 sobre la actual, historial y ganador al cerrar. Hoy las pujas viven en
 * el navegador (auctionStore); con Supabase serán en tiempo real para todos los postores.
 */

const INCREMENTO = 20;

// Una imagen por lote (generadas con Kling).
const IMAGENES: Record<string, { src: string; alt: string }> = {
  a1: { src: "/images/subastas/gesha.webp", alt: "Rama de cafeto con cerezas rojas maduras sobre un valle al amanecer" },
  a2: { src: "/images/subastas/bourbon.webp", alt: "Cerezas de café secándose al sol en camas elevadas" },
  a3: { src: "/images/subastas/reserva.webp", alt: "Muestra de café verde en una bandeja de madera junto a una lupa" },
};

export default function Subastas() {
  const { auctions, placeBid, tickTimers } = useAuctionStore();
  const [montos, setMontos] = useState<Record<string, string>>({});
  const [avisos, setAvisos] = useState<Record<string, { texto: string; error: boolean }>>({});
  const [pestana, setPestana] = useState<Pestana>("vivo");
  const [toast, setToast] = useState<{ titulo: string; texto: string; tipo: "ok" | "superado" } | null>(null);
  // Cuántas veces respondió ya un rival en cada lote (máximo 2, para que se pueda ganar).
  const respuestas = useRef<Record<string, number>>({});
  const esperando = useRef(new Set<string>());
  // Pujas que había al abrir la página: el monto solo destella con pujas nuevas.
  const [pujasIniciales] = useState(() => Object.fromEntries(auctions.map((a) => [a.id, a.bids.length])));

  // Simula a otros postores: cuando vas primero en un lote, a los 8-14 s alguien te supera
  // (solo una vez por lote) y aparece el aviso "Te superaron" (RF-13). Con Supabase llegará
  // en tiempo real desde las pujas de otros usuarios.
  useEffect(() => {
    for (const a of auctions) {
      if (a.currentBidder !== "Tú" || a.timeLeftSeconds === 0 || esperando.current.has(a.id)) continue;
      if ((respuestas.current[a.id] ?? 0) >= 2) continue;
      esperando.current.add(a.id);
      const rival = ["Café Mirador SCZ", "Roasters del Sur", "El Grano Fino", "Tienda Selecta"][Math.floor(Math.random() * 4)];
      window.setTimeout(() => {
        esperando.current.delete(a.id);
        const lote = useAuctionStore.getState().auctions.find((x) => x.id === a.id);
        if (!lote || lote.currentBidder !== "Tú" || lote.timeLeftSeconds === 0) return;
        respuestas.current[a.id] = (respuestas.current[a.id] ?? 0) + 1;
        const monto = lote.currentBid + INCREMENTO * 2;
        if (useAuctionStore.getState().placeBid(a.id, rival, monto)) {
          setToast({ tipo: "superado", titulo: "Te superaron", texto: `${rival} pujó ${formatBs(monto)} en ${lote.productName.split(" — ")[0]}. Puedes volver a pujar.` });
          setAvisos((x) => ({ ...x, [a.id]: { texto: "Te superaron. Vuelve a pujar si quieres el lote.", error: true } }));
        }
      }, 8000 + Math.random() * 6000);
    }
  }, [auctions]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 7000);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    const id = setInterval(tickTimers, 1000);
    return () => clearInterval(id);
  }, [tickTimers]);

  const pedirCuenta = useAuth((s) => s.pedirCuenta);
  const pujar = async (id: string) => {
    const lote = auctions.find((a) => a.id === id);
    if (!lote) return;
    const minimo = lote.bids.length ? lote.currentBid + INCREMENTO : lote.basePrice;
    const monto = Number(montos[id]);
    if (!monto || monto < minimo) {
      setAvisos((a) => ({ ...a, [id]: { texto: `Escribe al menos ${formatBs(minimo)}.`, error: true } }));
      return;
    }
    if (!(await pedirCuenta("Para pujar necesitas una cuenta. Tu monto se mantiene."))) return;
    if (placeBid(id, "Tú", monto)) {
      setToast({ tipo: "ok", titulo: "Vas primero", texto: `Tu puja de ${formatBs(monto)} va primera en ${lote.productName.split(" — ")[0]}.` });
      setAvisos((a) => ({ ...a, [id]: { texto: `Tu puja de ${formatBs(monto)} va primera.`, error: false } }));
      setMontos((m) => ({ ...m, [id]: "" }));
    }
  };

  return (
    <>
      <section className="section page-top" aria-labelledby="subastas-titulo">
        <div className="wrap">
          <div className="intro intro--media">
            <div data-revelar>
              <p className="eyebrow"><span className="en-vivo" aria-hidden="true" /> Subastas en vivo</p>
              <h1 id="subastas-titulo">Micro-lotes de Chuquisaca</h1>
              <p className="intro__lead">
                Lotes de producción limitada, directo de las fincas. Cada puja debe superar a la anterior
                en al menos {formatBs(INCREMENTO)}; la subasta se cierra sola y gana la puja más alta.
              </p>
            </div>
            <div data-revelar style={{ "--i": 1 } as React.CSSProperties}>
              <VideoUnaVez
                nombre="subasta-saco"
                bucle
                descripcion="Una pala de madera saca granos de café verde de un saco de yute"
              />
            </div>
          </div>

          <Pestanas pestana={pestana} setPestana={setPestana} enVivo={auctions.filter((a) => a.timeLeftSeconds > 0).length} />

          {pestana === "vivo" && (
          <div className="lotes" role="tabpanel" aria-label="Subastas en vivo">
            {auctions.map((a) => {
              const cerrada = a.timeLeftSeconds === 0;
              const urgente = !cerrada && a.timeLeftSeconds < 3600;
              const minimo = a.bids.length ? a.currentBid + INCREMENTO : a.basePrice;
              const img = IMAGENES[a.id];
              const aviso = avisos[a.id];
              const campo = `puja-${a.id}`;

              return (
                <article key={a.id} className={`lote${cerrada ? " is-cerrada" : ""}`}>
                  <div className="lote__visual">
                    {img && (
                      <Link href={`/subastas/lote?l=${a.id}`} aria-label={`Ver la ficha de ${a.productName}`}>
                        <img src={img.src} alt={img.alt} loading="lazy" decoding="async" />
                      </Link>
                    )}
                    <span className={`lote__reloj${urgente ? " is-urgente" : ""}`}>
                      {cerrada ? "Cerrada" : `Cierra en ${formatTimeLeft(a.timeLeftSeconds)}`}
                    </span>
                  </div>

                  <div className="lote__cuerpo">
                    <p className="lote__origen">
                      {a.origin} · {a.altitude.toLocaleString("es-BO")} msnm · {a.quantity} {a.unit}
                    </p>
                    <h2 className="lote__titulo">
                      <Link href={`/subastas/lote?l=${a.id}`}>{a.productName}</Link>
                    </h2>
                    <p className="lote__desc">{a.description}</p>

                    <div className="lote__puja">
                      <div>
                        <span className="lote__etiqueta">{a.bids.length ? "Puja actual" : "Precio de salida"}</span>
                        <span key={a.currentBid} className={`lote__monto${a.bids.length > (pujasIniciales[a.id] ?? 0) ? " lote__monto--nuevo" : ""}`}>{formatBs(a.bids.length ? a.currentBid : a.basePrice)}</span>
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
          )}
          {pestana === "proximas" && <Proximas />}
          {pestana === "cerradas" && <Cerradas />}
        </div>
      </section>

      <ComoFunciona />

      {toast && (
        <div className={`toast${toast.tipo === "ok" ? " toast--ok" : ""}`} role={toast.tipo === "ok" ? "status" : "alert"}>
          <strong>{toast.titulo}</strong>
          <span>{toast.texto}</span>
          <button type="button" className="toast__cerrar" aria-label="Cerrar aviso" onClick={() => setToast(null)}>×</button>
        </div>
      )}
    </>
  );
}
