"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { products } from "@/lib/data";
import { formatBs } from "@/lib/utils";
import { categoriaDe, esCafe } from "@/lib/catalogo";
import VideoUnaVez from "@/components/inicio/VideoUnaVez";

/**
 * Club Grano y Aroma (Suscripciones, RF-06 a RF-09).
 *
 * - Se arma en 4 pasos (frecuencia, cantidad, café, molienda) con el precio por envío, el
 *   ahorro frente a la tienda y las próximas fechas de envío y cobro calculadas al momento.
 * - La suscripción se guarda en el navegador (localStorage) hasta conectar Supabase, donde
 *   quedará ligada al perfil del usuario y el cobro recurrente lo hará una tarea programada.
 *
 * Precios: las bolsas de la tienda son de 250 g. El Club cobra el precio del café por cada
 * 250 g con 10 % de descuento si es cada 30 días y 15 % si es cada 15 días. La "Sorpresa del
 * tostador" vale Bs. 120 por 250 g, con el mismo descuento.
 */

type Frecuencia = 15 | 30;
type Gramos = 250 | 500 | 1000;
type Estado = "activa" | "pausada" | "cancelada";

type Suscripcion = {
  frecuencia: Frecuencia;
  gramos: Gramos;
  cafe: string; // "sorpresa" o el id del café
  molienda: string;
  estado: Estado;
  inicio: string; // fecha del primer envío (AAAA-MM-DD)
  saltos: number; // envíos saltados
  pausaHasta: string | null; // null = pausa sin fecha
};

const PRECIO_SORPRESA = 120;
const DESCUENTO: Record<Frecuencia, number> = { 15: 0.15, 30: 0.1 };
const CANTIDADES: { g: Gramos; label: string }[] = [
  { g: 250, label: "250 g" },
  { g: 500, label: "500 g" },
  { g: 1000, label: "1 kg" },
];
const MOLIENDAS = ["Grano entero", "Espresso", "V60", "Prensa francesa", "Moka"];
const CAFES = products.filter((p) => esCafe(p) && categoriaDe(p) === "grano");
const CLAVE = "ga-club-suscripcion";
const DIA = 86_400_000;

// ---------- Utilidades de fecha ----------
const hoy = () => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
};
const aISO = (d: Date) => d.toISOString().slice(0, 10);
const deISO = (s: string) => new Date(s + "T12:00:00");
const sumarDias = (d: Date, n: number) => new Date(d.getTime() + n * DIA);
const fechaLarga = (d: Date) => d.toLocaleDateString("es-BO", { weekday: "short", day: "numeric", month: "long" });

/** Próximos `n` envíos de una suscripción (o de una nueva, si no hay). */
function proximosEnvios(s: Pick<Suscripcion, "frecuencia" | "inicio" | "saltos" | "pausaHasta">, n = 3) {
  const desde = s.pausaHasta && deISO(s.pausaHasta) > hoy() ? deISO(s.pausaHasta) : hoy();
  let f = sumarDias(deISO(s.inicio), s.saltos * s.frecuencia);
  while (f < desde) f = sumarDias(f, s.frecuencia);
  return Array.from({ length: n }, (_, i) => sumarDias(f, i * s.frecuencia));
}

function precios(cafe: string, gramos: Gramos, frecuencia: Frecuencia) {
  const base = cafe === "sorpresa" ? PRECIO_SORPRESA : (CAFES.find((c) => c.id === cafe)?.price ?? PRECIO_SORPRESA);
  const tienda = base * (gramos / 250);
  const club = Math.round(tienda * (1 - DESCUENTO[frecuencia]));
  return { tienda, club, ahorro: tienda - club };
}

const nombreCafe = (id: string) => (id === "sorpresa" ? "Sorpresa del tostador" : CAFES.find((c) => c.id === id)?.name ?? "—");
const nombreCantidad = (g: Gramos) => CANTIDADES.find((c) => c.g === g)!.label;

// ---------- Guardado en el navegador ----------
const EVENTO = "ga-club-cambio";
function suscribirGuardado(cb: () => void) {
  window.addEventListener(EVENTO, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENTO, cb);
    window.removeEventListener("storage", cb);
  };
}
function leerGuardado() {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}
function guardar(s: Suscripcion | null) {
  try {
    if (s) localStorage.setItem(CLAVE, JSON.stringify(s));
    else localStorage.removeItem(CLAVE);
  } catch {
    // Sin almacenamiento (modo privado): la suscripción dura lo que dure la página.
  }
  window.dispatchEvent(new Event(EVENTO));
}

export default function Club() {
  const crudo = useSyncExternalStore(suscribirGuardado, leerGuardado, () => null);
  const sub = useMemo<Suscripcion | null>(() => {
    try {
      return crudo ? (JSON.parse(crudo) as Suscripcion) : null;
    } catch {
      return null;
    }
  }, [crudo]);

  // Formulario
  const [frecuencia, setFrecuencia] = useState<Frecuencia>(30);
  const [gramos, setGramos] = useState<Gramos>(500);
  const [cafe, setCafe] = useState("sorpresa");
  const [molienda, setMolienda] = useState("Grano entero");
  const [mensaje, setMensaje] = useState("");
  const [verPausa, setVerPausa] = useState(false);
  const cancelarRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLElement>(null);

  const p = precios(cafe, gramos, frecuencia);
  const vigente = sub && sub.estado !== "cancelada" ? sub : null;
  const fechasNuevas = proximosEnvios({ frecuencia, inicio: aISO(sumarDias(hoy(), 3)), saltos: 0, pausaHasta: null });

  const actualizar = (cambios: Partial<Suscripcion>) => sub && guardar({ ...sub, ...cambios });

  const suscribir = () => {
    if (vigente) {
      actualizar({ frecuencia, gramos, cafe, molienda });
      setMensaje("Guardamos los cambios: se aplican desde tu próximo envío.");
    } else {
      guardar({ frecuencia, gramos, cafe, molienda, estado: "activa", inicio: aISO(sumarDias(hoy(), 3)), saltos: 0, pausaHasta: null });
      setMensaje("¡Bienvenido al Club! Tu primer envío sale en 3 días.");
    }
    document.getElementById("mi-suscripcion")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const editar = () => {
    if (!sub) return;
    setFrecuencia(sub.frecuencia);
    setGramos(sub.gramos);
    setCafe(sub.cafe);
    setMolienda(sub.molienda);
    setMensaje("");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const pausar = (meses: number | null) => {
    actualizar({ estado: "pausada", pausaHasta: meses ? aISO(sumarDias(hoy(), meses * 30)) : null });
    setVerPausa(false);
  };

  // Datos de la suscripción guardada
  const ps = vigente ? precios(vigente.cafe, vigente.gramos, vigente.frecuencia) : null;
  const fechas = vigente && vigente.estado === "activa" ? proximosEnvios(vigente) : vigente?.pausaHasta ? proximosEnvios(vigente) : [];
  const enviosHechos = vigente
    ? Math.max(0, Math.floor((hoy().getTime() - deISO(vigente.inicio).getTime()) / DIA / vigente.frecuencia) + 1 - vigente.saltos)
    : 0;

  return (
    <>
      {/* 1. Presentación */}
      <section className="section page-top" aria-labelledby="club-titulo">
        <div className="wrap intro">
          <div data-revelar>
            <p className="eyebrow">Suscripción</p>
            <h1 id="club-titulo">Club Grano y Aroma</h1>
          </div>
          <div className="intro__texto" data-revelar style={{ "--i": 1 } as React.CSSProperties}>
            <p>
              Recibe café recién tostado cada 15 o 30 días, <strong>más barato que en la tienda</strong> y sin tener que
              pedirlo. Pausa, cambia o cancela cuando quieras.
            </p>
            <VideoUnaVez
              nombre="club-caja"
              descripcion="Una caja de cartón kraft se abre y deja ver dos bolsas de café con granos tostados"
              className="club__video"
            />
          </div>
        </div>
      </section>

      {/* 3. Tu suscripción (si existe) */}
      {vigente && ps && (
        <section className="section section--tight" id="mi-suscripcion" aria-labelledby="mi-sub-titulo">
          <div className="wrap">
            <div className="panel">
              <div className="panel__cabeza">
                <h2 id="mi-sub-titulo">Tu suscripción</h2>
                <span className={`estado estado--${vigente.estado}`}>{vigente.estado === "activa" ? "Activa" : "En pausa"}</span>
              </div>
              {mensaje && <p className="club__aviso" role="status">{mensaje}</p>}
              <dl className="panel__datos">
                <div><dt>Café</dt><dd>{nombreCafe(vigente.cafe)}</dd></div>
                <div><dt>Cada envío</dt><dd>{nombreCantidad(vigente.gramos)} · {vigente.molienda}</dd></div>
                <div><dt>Frecuencia</dt><dd>Cada {vigente.frecuencia} días</dd></div>
                <div><dt>Por envío</dt><dd>{formatBs(ps.club)}</dd></div>
              </dl>

              <div className="club__fechas">
                <div>
                  <h3>{vigente.estado === "activa" ? "Próximos envíos" : "Cuando se reactive"}</h3>
                  {fechas.length ? (
                    <ol>
                      {fechas.map((f, i) => (
                        <li key={i}>
                          <span>{fechaLarga(f)}</span>
                          <span className="club__fecha-nota">
                            {i === 0 ? `cobro de ${formatBs(ps.club)} el ${fechaLarga(sumarDias(f, -2))}` : formatBs(ps.club)}
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="panel__nota">Pausada sin fecha: no se te cobrará hasta que la reactives.</p>
                  )}
                  <p className="club__fecha-nota">Te avisamos por correo dos días antes de cada cobro y el día de cada envío.</p>
                </div>
                <div className="club__ahorro">
                  {enviosHechos > 0 ? (
                    <>
                      <span>Llevas ahorrado</span>
                      <strong>{formatBs(ps.ahorro * enviosHechos)}</strong>
                      <span>{enviosHechos === 1 ? "en 1 envío" : `en ${enviosHechos} envíos`} · {formatBs(ps.ahorro)} por envío</span>
                    </>
                  ) : (
                    <>
                      <span>Ahorras en cada envío</span>
                      <strong>{formatBs(ps.ahorro)}</strong>
                      <span>Al año: {formatBs(ps.ahorro * Math.round(365 / vigente.frecuencia))}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="panel__acciones">
                {vigente.estado === "activa" ? (
                  <>
                    <button type="button" className="btn btn--secondary" aria-expanded={verPausa} onClick={() => setVerPausa((v) => !v)}>
                      Pausar envíos
                    </button>
                    <button type="button" className="btn btn--secondary" onClick={() => actualizar({ saltos: vigente.saltos + 1 })}>
                      Saltar el próximo envío
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn btn--primary" onClick={() => actualizar({ estado: "activa", pausaHasta: null })}>
                    Reanudar envíos
                  </button>
                )}
                <button type="button" className="btn btn--secondary" onClick={editar}>Cambiar café o cantidad</button>
                <button type="button" className="btn btn--peligro" onClick={() => cancelarRef.current?.showModal()}>
                  Cancelar suscripción
                </button>
              </div>

              {verPausa && (
                <div className="club__pausa" role="group" aria-label="¿Por cuánto tiempo?">
                  <span>¿Por cuánto tiempo?</span>
                  <button type="button" className="chip" onClick={() => pausar(1)}>1 mes</button>
                  <button type="button" className="chip" onClick={() => pausar(2)}>2 meses</button>
                  <button type="button" className="chip" onClick={() => pausar(null)}>Hasta que la reactive</button>
                </div>
              )}
            </div>
          </div>

          <dialog ref={cancelarRef} className="dialogo club__dialogo" aria-labelledby="cancelar-titulo">
            <h2 id="cancelar-titulo">¿Cancelar tu suscripción?</h2>
            <p>
              Dejarás de recibir {nombreCafe(vigente.cafe).toLowerCase()} y perderás el ahorro de {formatBs(ps.ahorro)} por envío.
              Si solo necesitas un descanso, puedes pausarla.
            </p>
            <div className="equipo__fila">
              <button type="button" className="btn btn--secondary" onClick={() => { cancelarRef.current?.close(); setVerPausa(true); }}>
                Mejor la pauso
              </button>
              <button
                type="button"
                className="btn btn--peligro"
                onClick={() => {
                  guardar(null);
                  setMensaje("");
                  cancelarRef.current?.close();
                }}
              >
                Sí, cancelar
              </button>
            </div>
          </dialog>
        </section>
      )}

      {/* 2. Configurador */}
      <section ref={formRef} className="section" id="configurar" aria-labelledby="config-titulo">
        <div className="wrap">
          <div className="head" data-revelar>
            <h2 id="config-titulo">{vigente ? "Cambia tu suscripción" : "Arma tu suscripción"}</h2>
            <div>
              <p>Cuatro elecciones y listo. El precio y las fechas se calculan al momento.</p>
            </div>
          </div>

          <div className="club__config">
            <div className="club__pasos">
              <fieldset className="club__paso desde-izq" data-revelar>
                <legend><span>1</span> Cada cuánto</legend>
                <div className="planes planes--club">
                  {([30, 15] as Frecuencia[]).map((f, i) => (
                    <label key={f} className={`plan ${i ? "desde-der" : "desde-izq"}${frecuencia === f ? " is-on" : ""}`} data-revelar style={{ "--i": i + 1 } as React.CSSProperties}>
                      <input type="radio" name="frecuencia" checked={frecuencia === f} onChange={() => setFrecuencia(f)} />
                      <span className="plan__nombre">Cada {f} días</span>
                      <span className="plan__ahorro">{Math.round(DESCUENTO[f] * 100)} % menos que en la tienda</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="club__paso desde-izq" data-revelar>
                <legend><span>2</span> Cuánto café por envío</legend>
                <div className="filtros__opciones">
                  {CANTIDADES.map((c) => (
                    <button key={c.g} type="button" className={`chip${gramos === c.g ? " is-on" : ""}`} aria-pressed={gramos === c.g} onClick={() => setGramos(c.g)}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="club__paso desde-izq" data-revelar>
                <legend><span>3</span> Qué café</legend>
                <div className="club__cafes">
                  <button type="button" data-revelar className={`club__cafe club__cafe--sorpresa desde-izq${cafe === "sorpresa" ? " is-on" : ""}`} aria-pressed={cafe === "sorpresa"} onClick={() => setCafe("sorpresa")}>
                    <strong>Sorpresa del tostador</strong>
                    <span>Un café distinto en cada envío, elegido de los lotes recién tostados · {formatBs(PRECIO_SORPRESA)} los 250 g</span>
                  </button>
                  {CAFES.map((c, i) => (
                    <button key={c.id} type="button" data-revelar style={{ "--i": Math.floor(i / 2) + 1 } as React.CSSProperties} className={`club__cafe ${i % 2 ? "desde-der" : "desde-izq"}${cafe === c.id ? " is-on" : ""}`} aria-pressed={cafe === c.id} onClick={() => setCafe(c.id)}>
                      <strong>{c.name}</strong>
                      <span>{c.region} · {formatBs(c.price)} los 250 g</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="club__paso desde-izq" data-revelar>
                <legend><span>4</span> Molienda</legend>
                <div className="filtros__opciones">
                  {MOLIENDAS.map((m) => (
                    <button key={m} type="button" className={`chip${molienda === m ? " is-on" : ""}`} aria-pressed={molienda === m} onClick={() => setMolienda(m)}>
                      {m}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            <aside className="club__resumen desde-der" data-revelar aria-live="polite">
              <h3>Tu envío</h3>
              <p className="club__linea">{nombreCafe(cafe)} · {nombreCantidad(gramos)} · {molienda}</p>
              <dl className="club__cuentas">
                <dt>En la tienda</dt><dd><s>{formatBs(p.tienda)}</s></dd>
                <dt>Con el Club</dt><dd className="club__total">{formatBs(p.club)}</dd>
                <dt>Ahorras</dt><dd className="club__ahorra">{formatBs(p.ahorro)} por envío</dd>
                <dt>Envío en Sucre</dt><dd>Sin costo</dd>
              </dl>
              {!vigente && (
                <div className="club__primeros">
                  <span>Primeros envíos</span>
                  <ol>
                    {fechasNuevas.map((f, i) => <li key={i}>{fechaLarga(f)}</li>)}
                  </ol>
                </div>
              )}
              <button type="button" className="btn btn--primary club__boton" onClick={suscribir}>
                {vigente ? "Guardar cambios" : `Suscribirme · ${formatBs(p.club)} por envío`}
              </button>
              <p className="club__fecha-nota">Pago de demostración: no se realiza ningún cobro real.</p>
            </aside>
          </div>
        </div>
      </section>

      {/* 4. Cómo funciona y beneficios */}
      <section className="section" aria-labelledby="como-titulo">
        <div className="wrap">
          <div className="head" data-revelar>
            <h2 id="como-titulo">Cómo funciona el Club</h2>
          </div>
          <ol className="pasos">
            {[
              ["Eliges", "Frecuencia, cantidad, café y molienda. Puedes cambiarlos antes de cada envío."],
              ["Tostamos", "Tu café sale de un lote recién tostado, con su código de trazabilidad."],
              ["Te llega", "Te avisamos antes de cada cobro y de cada envío. Pausas cuando quieras."],
            ].map(([t, d], i) => (
              <li key={t} className="paso" data-revelar style={{ "--i": i } as React.CSSProperties}>
                <span className="paso__num">0{i + 1}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </li>
            ))}
          </ol>
          <ul className="beneficios" data-revelar>
            <li>10 a 15 % menos que en la tienda</li>
            <li>Envío sin costo en Sucre</li>
            <li>Notas de cata del tostador en cada bolsa</li>
            <li>Acceso anticipado a las subastas</li>
          </ul>
        </div>
      </section>

      {/* 5. Preguntas */}
      <section className="section" aria-labelledby="club-faq-titulo">
        <div className="wrap">
          <div className="head" data-revelar>
            <h2 id="club-faq-titulo">Preguntas del Club</h2>
          </div>
          <div className="faq" data-revelar>
            {[
              ["¿Cuándo me cobran?", "Dos días antes de cada envío, con el método de pago que registraste. Te avisamos por correo antes de cada cobro."],
              ["¿Puedo cancelar cuando quiera?", "Sí. No hay permanencia mínima: puedes pausar, saltar un envío o cancelar desde esta página."],
              ["¿Qué es la Sorpresa del tostador?", "Cada envío trae un café distinto, elegido por nuestro tostador entre los lotes recién tostados. Es la forma de probar todos nuestros orígenes."],
              ["¿Envían fuera de Sucre?", "Por ahora el envío sin costo es solo en Sucre. Para otras ciudades escríbenos y te cotizamos el envío."],
            ].map(([q, a]) => (
              <details key={q} className="faq__item">
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
