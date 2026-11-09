"use client";

/* eslint-disable @next/next/no-img-element -- export estático: next/image no optimiza aquí */
import Link from "next/link";
import { useState } from "react";
import { Cerradas, ComoFunciona, Pestanas, Proximas, type Pestana } from "./SubastasExtra";
import { AvisoSubasta, horaDe, tiempo, useSubastasEnVivo } from "./EnVivo";
import { abierta, minimoDe, nombreCorto, segundosA, useSubastas } from "@/store/subastasStore";
import { formatBs } from "@/lib/utils";
import VideoUnaVez from "@/components/inicio/VideoUnaVez";
import { useAuth } from "@/store/authStore";

/**
 * Subastas de micro-lotes en vivo (RF-10 a RF-16). Los lotes, las pujas y el cierre viven en
 * Supabase: cada puja pasa por realizar_puja() (bloquea el lote, RNF-09) y Realtime avisa a
 * todos los navegadores al instante. La subasta se cierra sola (pg_cron) con un solo ganador.
 */

const INCREMENTO = 20;

export default function Subastas() {
  useSubastasEnVivo();
  const { subastas, pujas, cargando, error, ahora, pujar: registrar, setAviso } = useSubastas();
  const yo = useAuth((s) => s.session?.user.id);
  const [montos, setMontos] = useState<Record<number, string>>({});
  const [avisos, setAvisos] = useState<Record<number, { texto: string; error: boolean }>>({});
  const [enviando, setEnviando] = useState<number | null>(null);
  const [pestana, setPestana] = useState<Pestana>("vivo");

  // En vivo: activas que aún no vencen (y las recién vencidas hasta que el cierre las mueva).
  const enVivo = subastas.filter((s) => s.estado === "activa" || (s.estado === "proxima" && new Date(s.abre_en).getTime() <= ahora));
  const proximas = subastas.filter((s) => s.estado === "proxima" && new Date(s.abre_en).getTime() > ahora);
  const cerradas = subastas.filter((s) => s.estado === "cerrada").reverse();

  const pedirCuenta = useAuth((s) => s.pedirCuenta);
  const pujar = async (id: number) => {
    const lote = subastas.find((s) => s.id === id);
    if (!lote) return;
    const minimo = minimoDe(lote);
    const monto = Number(montos[id]);
    if (!monto || monto < minimo) {
      setAvisos((a) => ({ ...a, [id]: { texto: `Escribe al menos ${formatBs(minimo)}.`, error: true } }));
      return;
    }
    if (!(await pedirCuenta("Para pujar necesitas una cuenta. Tu monto se mantiene."))) return;
    setEnviando(id);
    const fallo = await registrar(id, monto);
    setEnviando(null);
    if (fallo) {
      setAvisos((a) => ({ ...a, [id]: { texto: fallo, error: true } }));
      return;
    }
    setAviso({ tipo: "ok", titulo: "Vas primero", texto: `Tu puja de ${formatBs(monto)} va primera en ${nombreCorto(lote.titulo)}.` });
    setAvisos((a) => ({ ...a, [id]: { texto: `Tu puja de ${formatBs(monto)} va primera.`, error: false } }));
    setMontos((m) => ({ ...m, [id]: "" }));
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

          <Pestanas
            pestana={pestana}
            setPestana={setPestana}
            n={{ vivo: enVivo.filter((s) => abierta(s, ahora)).length, proximas: proximas.length, cerradas: cerradas.length }}
          />

          {cargando ? (
            <p className="filtros__vacio" aria-busy="true">Cargando subastas…</p>
          ) : error ? (
            <p className="filtros__vacio" role="alert">{error}</p>
          ) : pestana === "vivo" ? (
            enVivo.length === 0 ? (
              <p className="filtros__vacio">No hay subastas en vivo ahora. Mira las próximas y pide que te avisemos.</p>
            ) : (
              <div className="lotes" role="tabpanel" aria-label="Subastas en vivo">
                {enVivo.map((a) => {
                  const seg = segundosA(a.cierra_en, ahora);
                  const cerrada = !abierta(a, ahora);
                  const urgente = !cerrada && seg < 3600;
                  const minimo = minimoDe(a);
                  const hayPujas = a.num_pujas > 0;
                  const voyPrimero = !!yo && a.lider_id === yo;
                  const aviso = avisos[a.id];
                  const campo = `puja-${a.id}`;
                  const ultimas = (pujas[a.id] ?? []).slice(0, 3);

                  return (
                    <article key={a.id} className={`lote${cerrada ? " is-cerrada" : ""}`}>
                      <div className="lote__visual">
                        {a.imagen && (
                          <Link href={`/subastas/lote?l=${a.id}`} aria-label={`Ver la ficha de ${a.titulo}`}>
                            <img src={a.imagen} alt={a.imagen_alt ?? ""} loading="lazy" decoding="async" />
                          </Link>
                        )}
                        <span className={`lote__reloj${urgente ? " is-urgente" : ""}`}>
                          {cerrada ? "Cerrando…" : `Cierra en ${tiempo(seg)}`}
                        </span>
                      </div>

                      <div className="lote__cuerpo">
                        <p className="lote__origen">
                          {a.origen}
                          {a.altitud ? ` · ${a.altitud.toLocaleString("es-BO")} msnm` : ""}
                          {a.cantidad_kg ? ` · ${a.cantidad_kg.toLocaleString("es-BO")} kg` : ""}
                        </p>
                        <h2 className="lote__titulo">
                          <Link href={`/subastas/lote?l=${a.id}`}>{a.titulo}</Link>
                        </h2>
                        <p className="lote__desc">{a.descripcion}</p>

                        <div className="lote__puja">
                          <div>
                            <span className="lote__etiqueta">{hayPujas ? "Puja actual" : "Precio de salida"}</span>
                            <span key={a.puja_actual ?? 0} className={`lote__monto${hayPujas ? " lote__monto--nuevo" : ""}`}>
                              {formatBs(a.puja_actual ?? a.precio_base)}
                            </span>
                          </div>
                          <div className="lote__lider">
                            <span className="lote__etiqueta">
                              {a.num_pujas === 1 ? "1 puja" : `${a.num_pujas} pujas`}
                              {a.puntaje ? ` · ${a.puntaje.toLocaleString("es-BO", { minimumFractionDigits: 1 })} puntos` : ""}
                            </span>
                            {a.lider_nombre && <span>Va primero: {voyPrimero ? "Tú" : a.lider_nombre}</span>}
                          </div>
                        </div>

                        {ultimas.length > 0 && (
                          <ol className="lote__historial" aria-label="Últimas pujas">
                            {ultimas.map((b) => (
                              <li key={b.id}>
                                <span>{b.es_mia ? "Tú" : b.postor}</span>
                                <span>{formatBs(b.monto)}</span>
                                <span className="lote__hora">{horaDe(b.creado_en)}</span>
                              </li>
                            ))}
                          </ol>
                        )}

                        {!cerrada ? (
                          voyPrimero ? (
                            <p className="lote__aviso" role="status">Vas primero con {formatBs(a.puja_actual ?? 0)}. Te avisamos si alguien te supera.</p>
                          ) : (
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
                                <button type="submit" className="btn btn--primary" disabled={enviando === a.id}>
                                  {enviando === a.id ? "Pujando…" : "Pujar"}
                                </button>
                              </div>
                              <p id={`${campo}-aviso`} className={`lote__aviso${aviso?.error ? " is-error" : ""}`} role="status">
                                {aviso?.texto}
                              </p>
                            </form>
                          )
                        ) : (
                          <p className="lote__resultado">
                            {a.lider_nombre
                              ? `Cerró. Va a ganar ${voyPrimero ? "tu puja" : a.lider_nombre} con ${formatBs(a.puja_actual ?? 0)}.`
                              : "Cerró sin pujas: el lote no se adjudicó."}
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )
          ) : pestana === "proximas" ? (
            <Proximas lista={proximas} ahora={ahora} />
          ) : (
            <Cerradas lista={cerradas} />
          )}
        </div>
      </section>

      <ComoFunciona />
      <AvisoSubasta />
    </>
  );
}
