"use client";

/* eslint-disable @next/next/no-img-element -- export estático: next/image no optimiza aquí */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/store/authStore";
import { abierta, minimoDe, nombreCorto, segundosA, useSubastas, type Puja, type Subasta } from "@/store/subastasStore";
import { AvisoSubasta, horaDe, tiempo, useSubastasEnVivo } from "./EnVivo";
import { formatBs } from "@/lib/utils";

/**
 * Ficha de un lote en subasta: /subastas/lote?l=<id>.
 * Puja en vivo con Supabase (misma regla: Bs. 20 sobre la actual), rueda de catación, historia
 * del lote, gráfica de cómo subió el precio e historial completo de pujas, todo desde la base.
 */

export default function FichaLote() {
  useSubastasEnVivo();
  const id = Number(useSearchParams().get("l"));
  const lote = useSubastas((s) => s.subastas.find((a) => a.id === id));
  const cargando = useSubastas((s) => s.cargando);

  if (cargando) {
    return (
      <section className="section page-top">
        <div className="wrap"><p aria-busy="true">Cargando el lote…</p></div>
      </section>
    );
  }
  if (!lote) {
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

const SIN_PUJAS: Puja[] = [];

function Lote({ lote }: { lote: Subasta }) {
  const ahora = useSubastas((s) => s.ahora);
  const pujas = useSubastas((s) => s.pujas[lote.id] ?? SIN_PUJAS);
  const registrar = useSubastas((s) => s.pujar);
  const setAvisoFlotante = useSubastas((s) => s.setAviso);
  const yo = useAuth((s) => s.session?.user.id);
  const [monto, setMonto] = useState("");
  const [aviso, setAviso] = useState<{ texto: string; error: boolean } | null>(null);
  const [enviando, setEnviando] = useState(false);

  const proxima = lote.estado === "proxima" && new Date(lote.abre_en).getTime() > ahora;
  const enCurso = abierta(lote, ahora);
  const cerrada = !proxima && !enCurso;
  const seg = segundosA(proxima ? lote.abre_en : lote.cierra_en, ahora);
  const minimo = minimoDe(lote);
  const hayPujas = lote.num_pujas > 0;
  const voyPrimero = !!yo && lote.lider_id === yo;
  const ganador = lote.ganador_nombre ?? lote.lider_nombre;

  useEffect(() => {
    document.title = `${lote.titulo} · Subastas · Grano y Aroma`;
  }, [lote.titulo]);

  const pedirCuenta = useAuth((s) => s.pedirCuenta);
  const pujar = async (e: React.FormEvent) => {
    e.preventDefault();
    const m = Number(monto);
    if (!m || m < minimo) return setAviso({ texto: `Escribe al menos ${formatBs(minimo)}.`, error: true });
    if (!(await pedirCuenta("Para pujar necesitas una cuenta. Tu monto se mantiene."))) return;
    setEnviando(true);
    const fallo = await registrar(lote.id, m);
    setEnviando(false);
    if (fallo) return setAviso({ texto: fallo, error: true });
    setAviso({ texto: `Tu puja de ${formatBs(m)} va primera.`, error: false });
    setAvisoFlotante({ tipo: "ok", titulo: "Vas primero", texto: `Tu puja de ${formatBs(m)} va primera en ${nombreCorto(lote.titulo)}.` });
    setMonto("");
  };

  const datos: [string, string | null][] = [
    ["Finca", lote.finca],
    ["Variedad", lote.variedad],
    ["Proceso", lote.proceso],
    ["Cosecha", lote.cosecha],
    ["Código", lote.codigo_lote],
    ["Puntaje de catación", lote.puntaje ? `${lote.puntaje.toLocaleString("es-BO", { minimumFractionDigits: 1 })} puntos` : null],
  ];

  return (
    <>
      <section className="section page-top" aria-labelledby="lote-titulo">
        <div className="wrap">
          <nav className="migas" aria-label="Estás en">
            <Link href="/subastas" className="link">Subastas</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{nombreCorto(lote.titulo)}</span>
          </nav>

          <div className="ficha">
            <div className="ficha__visual">
              <figure className="lote-ficha__foto">
                {lote.imagen && <img src={lote.imagen} alt={lote.imagen_alt ?? ""} />}
                <span className={`lote__reloj${enCurso && seg < 3600 ? " is-urgente" : ""}`}>
                  {proxima ? `Abre en ${tiempo(seg)}` : enCurso ? `Cierra en ${tiempo(seg)}` : "Cerrada"}
                </span>
              </figure>
            </div>

            <div className="ficha__info">
              <p className="ficha__origen">
                {lote.origen}
                {lote.altitud ? ` · ${lote.altitud.toLocaleString("es-BO")} msnm` : ""}
                {lote.cantidad_kg ? ` · ${lote.cantidad_kg.toLocaleString("es-BO")} kg` : ""}
              </p>
              <h1 id="lote-titulo" className="ficha__titulo">{lote.titulo}</h1>
              <p className="ficha__notas">{lote.descripcion}</p>

              <div className="ficha__compra lote-ficha__puja">
                <div className="lote-ficha__actual">
                  <span className="lote__etiqueta">{hayPujas ? (cerrada ? "Precio final" : "Puja actual") : "Precio de salida"}</span>
                  <span className="ficha__precio">{formatBs(lote.puja_actual ?? lote.precio_base)}</span>
                  <span className="lote__etiqueta">
                    {lote.num_pujas === 1 ? "1 puja" : `${lote.num_pujas} pujas`}
                    {!cerrada && lote.lider_nombre && ` · va primero ${voyPrimero ? "tu puja" : lote.lider_nombre}`}
                  </span>
                </div>
                {proxima ? (
                  <p className="lote__resultado">Esta subasta abre pronto. Desde la página de subastas puedes pedir que te avisemos.</p>
                ) : enCurso ? (
                  voyPrimero ? (
                    <p className="lote__aviso" role="status">Vas primero. Te avisamos si alguien te supera.</p>
                  ) : (
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
                        <button type="submit" className="btn btn--primary" disabled={enviando}>
                          {enviando ? "Pujando…" : "Pujar"}
                        </button>
                      </div>
                      <p id="puja-ficha-aviso" className={`lote__aviso${aviso?.error ? " is-error" : ""}`} role="status">{aviso?.texto}</p>
                    </form>
                  )
                ) : (
                  <p className="lote__resultado">
                    {ganador ? `Ganó ${voyPrimero ? "tu puja" : ganador} con ${formatBs(lote.puja_actual ?? 0)}.` : "Cerró sin pujas."}
                  </p>
                )}
              </div>

              <h2 className="ficha__subtitulo">El lote</h2>
              <dl className="ficha__datos">
                {datos.filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} style={{ display: "contents" }}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      <section className="section section--tight" aria-labelledby="catacion-titulo">
        <div className="wrap">
          <div className="head" data-revelar>
            <h2 id="catacion-titulo">{lote.catacion ? "Cómo sabe en la taza" : "Cómo va la subasta"}</h2>
            <div>{lote.historia && <p>{lote.historia}</p>}</div>
          </div>
          <div className="lote-graficos">
            {lote.catacion && lote.catacion.length >= 3 && (
              <figure className="lote-grafico desde-izq" data-revelar>
                <figcaption>Rueda de catación</figcaption>
                <Rueda atributos={lote.catacion} />
              </figure>
            )}
            <figure className="lote-grafico desde-der" data-revelar>
              <figcaption>Cómo subió el precio</figcaption>
              <Grafica base={lote.precio_base} pujas={pujas} />
            </figure>
          </div>
        </div>
      </section>

      <section className="section section--tight" aria-labelledby="historial-titulo">
        <div className="wrap">
          <div className="head">
            <h2 id="historial-titulo">Todas las pujas</h2>
          </div>
          {pujas.length ? (
            <div className="tabla-pujas">
              <table>
                <thead>
                  <tr><th scope="col">Postor</th><th scope="col" className="num">Monto</th><th scope="col" className="num">Hora</th></tr>
                </thead>
                <tbody>
                  {pujas.map((b, i) => (
                    <tr key={b.id} className={i === 0 ? "is-primera" : ""}>
                      <td>{b.es_mia ? "Tú" : b.postor}{i === 0 && <small> · {cerrada ? "ganó" : "va primero"}</small>}</td>
                      <td className="num">{formatBs(b.monto)}</td>
                      <td className="num">{horaDe(b.creado_en)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="filtros__vacio">
              {cerrada && hayPujas ? `Esta subasta cerró con ${lote.num_pujas} pujas.` : "Todavía no hay pujas: la primera puede ser la tuya."}
            </p>
          )}
          <p className="caja__sub" style={{ marginTop: 24 }}>
            <Link href="/subastas" className="link">← Volver a las subastas</Link>
          </p>
        </div>
      </section>
      <AvisoSubasta />
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
function Grafica({ base, pujas }: { base: number; pujas: Puja[] }) {
  const serie = [base, ...[...pujas].reverse().map((b) => b.monto)];
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
