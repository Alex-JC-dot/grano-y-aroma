"use client";

import { useState } from "react";
import { formatBs } from "@/lib/utils";
import VideoUnaVez from "@/components/inicio/VideoUnaVez";

/**
 * Club Grano y Aroma (módulo de Suscripciones, RF-06 a RF-09).
 * Misma estructura que el prototipo del Lab 8 (suscripción activa, planes, cantidad,
 * molienda y beneficios) con el estilo nuevo. Los datos aún son de prueba: la suscripción
 * real y el cobro recurrente vendrán de Supabase.
 */

const PLANES = [
  { id: "quincenal", nombre: "Quincenal", cada: "Cada 15 días", precio: 89, ahorro: "5 %" },
  { id: "mensual", nombre: "Mensual", cada: "Cada 30 días", precio: 155, ahorro: "10 %", destacado: true },
] as const;
const CANTIDADES = ["250 g", "500 g", "1 kg"];
const MOLIENDAS = ["Grano entero", "Espresso", "V60", "Prensa francesa", "Moka"];

const SUSCRIPCION_DE_PRUEBA = {
  plan: "Mensual",
  cantidad: "500 g",
  molienda: "V60",
  proximaEntrega: "22 de octubre de 2025",
  cafe: "Villa Serrano Natural",
};

type Estado = "activa" | "pausada" | "cancelada";

export default function Club() {
  const [estado, setEstado] = useState<Estado>("activa");
  const [plan, setPlan] = useState<string>("mensual");
  const [cantidad, setCantidad] = useState("500 g");
  const [molienda, setMolienda] = useState("V60");
  const [mensaje, setMensaje] = useState("");

  const elegido = PLANES.find((p) => p.id === plan)!;

  const guardar = () =>
    setMensaje(
      `Listo: plan ${elegido.nombre.toLowerCase()} de ${cantidad}, molienda ${molienda.toLowerCase()}. ` +
        `Tu próximo envío sale en 3 a 5 días hábiles.`,
    );

  return (
    <>
      {/* Presentación */}
      <section className="section page-top" aria-labelledby="club-titulo">
        <div className="wrap intro">
          <div data-revelar>
            <p className="eyebrow">Suscripción</p>
            <h1 id="club-titulo">Club Grano y Aroma</h1>
          </div>
          <div className="intro__texto" data-revelar style={{ "--i": 1 } as React.CSSProperties}>
            <p>
              Recibe café recién tostado en tu puerta cada 15 o 30 días. Tú eliges la cantidad y la
              molienda, y puedes pausar o cancelar cuando quieras.
            </p>
            <VideoUnaVez
              nombre="club-caja"
              descripcion="Una caja de cartón kraft se abre y deja ver dos bolsas de café con granos tostados"
              className="club__video"
            />
          </div>
        </div>
      </section>

      {/* Suscripción activa */}
      <section className="section section--tight" aria-labelledby="mi-sub-titulo">
        <div className="wrap">
          <div className="panel" data-revelar>
            <div className="panel__cabeza">
              <h2 id="mi-sub-titulo">Tu suscripción</h2>
              <span className={`estado estado--${estado}`}>{estado}</span>
            </div>
            <dl className="panel__datos">
              <div><dt>Plan</dt><dd>{SUSCRIPCION_DE_PRUEBA.plan}</dd></div>
              <div><dt>Cantidad</dt><dd>{SUSCRIPCION_DE_PRUEBA.cantidad}</dd></div>
              <div><dt>Molienda</dt><dd>{SUSCRIPCION_DE_PRUEBA.molienda}</dd></div>
              <div>
                <dt>Próxima entrega</dt>
                <dd>{estado === "activa" ? SUSCRIPCION_DE_PRUEBA.proximaEntrega : "—"}</dd>
              </div>
            </dl>
            <p className="panel__nota">
              {estado === "activa" && <>Estamos preparando <strong>{SUSCRIPCION_DE_PRUEBA.cafe}</strong> para tu próximo envío.</>}
              {estado === "pausada" && "Tu suscripción está en pausa: no se te cobrará hasta que la reanudes."}
              {estado === "cancelada" && "Cancelaste tu suscripción. Puedes volver a activarla cuando quieras."}
            </p>
            <div className="panel__acciones">
              {estado !== "cancelada" ? (
                <>
                  <button type="button" className="btn btn--secondary" onClick={() => setEstado(estado === "activa" ? "pausada" : "activa")}>
                    {estado === "activa" ? "Pausar envíos" : "Reanudar envíos"}
                  </button>
                  <a href="#configurar" className="btn btn--secondary">Cambiar plan o molienda</a>
                  <button type="button" className="btn btn--peligro" onClick={() => setEstado("cancelada")}>
                    Cancelar suscripción
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn--primary" onClick={() => setEstado("activa")}>
                  Volver a activar
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Configurador */}
      <section className="section" id="configurar" aria-labelledby="config-titulo">
        <div className="wrap">
          <div className="head" data-revelar>
            <h2 id="config-titulo">Arma tu suscripción</h2>
            <div><p>Cambia lo que quieras: se aplica desde el próximo envío.</p></div>
          </div>

          <fieldset className="planes" data-revelar>
            <legend className="sr-only">Frecuencia</legend>
            {PLANES.map((p) => (
              <label key={p.id} className={`plan${plan === p.id ? " is-on" : ""}`}>
                <input type="radio" name="plan" value={p.id} checked={plan === p.id} onChange={() => setPlan(p.id)} />
                {"destacado" in p && p.destacado && <span className="plan__sello">El más elegido</span>}
                <span className="plan__nombre">{p.nombre}</span>
                <span className="plan__cada">{p.cada}</span>
                <span className="plan__precio">
                  {formatBs(p.precio)} <small>por entrega</small>
                </span>
                <span className="plan__ahorro">Ahorras {p.ahorro} frente a la tienda</span>
              </label>
            ))}
          </fieldset>

          <div className="preferencias" data-revelar>
            <fieldset className="filtros__grupo">
              <legend>Cantidad por entrega</legend>
              <div className="filtros__opciones">
                {CANTIDADES.map((c) => (
                  <button key={c} type="button" className={`chip${cantidad === c ? " is-on" : ""}`} aria-pressed={cantidad === c} onClick={() => setCantidad(c)}>
                    {c}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="filtros__grupo">
              <legend>Molienda</legend>
              <div className="filtros__opciones">
                {MOLIENDAS.map((m) => (
                  <button key={m} type="button" className={`chip${molienda === m ? " is-on" : ""}`} aria-pressed={molienda === m} onClick={() => setMolienda(m)}>
                    {m}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="resumen" data-revelar>
            <p>
              <strong>{elegido.nombre}</strong> · {cantidad} · {molienda} — {formatBs(elegido.precio)} por entrega
            </p>
            <button type="button" className="btn btn--primary" onClick={guardar}>
              {estado === "cancelada" ? "Suscribirme" : "Guardar cambios"}
            </button>
          </div>
          <p className="resumen__mensaje" role="status">{mensaje}</p>
        </div>
      </section>

      {/* Cómo funciona y beneficios */}
      <section className="section" aria-labelledby="como-titulo">
        <div className="wrap">
          <div className="head" data-revelar>
            <h2 id="como-titulo">Cómo funciona el Club</h2>
          </div>
          <ol className="pasos">
            {[
              ["Eliges", "Frecuencia, cantidad y molienda. Puedes cambiarlas antes de cada envío."],
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
            <li>Envío sin costo en Sucre</li>
            <li>Notas de cata del tostador en cada bolsa</li>
            <li>Acceso anticipado a las subastas</li>
            <li>15 % de descuento en la tienda</li>
          </ul>
        </div>
      </section>
    </>
  );
}
