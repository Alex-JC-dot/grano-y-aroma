"use client";

/* eslint-disable @next/next/no-img-element -- export estático: next/image no optimiza aquí */
import { formatBs } from "@/lib/utils";
import { useAuth } from "@/store/authStore";
import { segundosA, useSubastas, type Subasta } from "@/store/subastasStore";
import { tiempo } from "./EnVivo";

/**
 * Partes de la página de Subastas: pestañas, próximas subastas (con aviso de apertura),
 * historial de subastas cerradas (RF-16) y "Cómo funciona". Todo sale de Supabase; el admin
 * publica los lotes desde su panel.
 */

export type Pestana = "vivo" | "proximas" | "cerradas";

export function Pestanas({
  pestana,
  setPestana,
  n,
}: {
  pestana: Pestana;
  setPestana: (p: Pestana) => void;
  n: Record<Pestana, number>;
}) {
  const items: { id: Pestana; label: string }[] = [
    { id: "vivo", label: "En vivo" },
    { id: "proximas", label: "Próximas" },
    { id: "cerradas", label: "Cerradas" },
  ];
  return (
    <div className="categorias subastas__pestanas" role="tablist" aria-label="Subastas" data-revelar>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="tab"
          aria-selected={pestana === it.id}
          className={`categoria${pestana === it.id ? " is-on" : ""}`}
          onClick={() => setPestana(it.id)}
        >
          {it.id === "vivo" && <span className="en-vivo" aria-hidden="true" />} {it.label} <span>{n[it.id]}</span>
        </button>
      ))}
    </div>
  );
}

export function Proximas({ lista, ahora }: { lista: Subasta[]; ahora: number }) {
  const avisos = useSubastas((s) => s.avisos);
  const alternar = useSubastas((s) => s.alternarAviso);
  const pedirCuenta = useAuth((s) => s.pedirCuenta);

  if (lista.length === 0) {
    return <p className="filtros__vacio">No hay subastas programadas por ahora. Vuelve pronto.</p>;
  }
  return (
    <div className="lotes" role="tabpanel" aria-label="Próximas subastas">
      {lista.map((p) => {
        const avisar = avisos.has(p.id);
        return (
          <article key={p.id} className="lote">
            <div className="lote__visual">
              {p.imagen && <img src={p.imagen} alt={p.imagen_alt ?? ""} loading="lazy" decoding="async" />}
              <span className="lote__reloj">Abre en {tiempo(segundosA(p.abre_en, ahora))}</span>
            </div>
            <div className="lote__cuerpo">
              <p className="lote__origen">
                {p.origen}
                {p.altitud ? ` · ${p.altitud.toLocaleString("es-BO")} msnm` : ""}
                {p.cantidad_kg ? ` · ${p.cantidad_kg.toLocaleString("es-BO")} kg` : ""}
              </p>
              <h2 className="lote__titulo">{p.titulo}</h2>
              <p className="lote__desc">{p.descripcion}</p>
              <div className="lote__puja">
                <div>
                  <span className="lote__etiqueta">Precio de salida</span>
                  <span className="lote__monto">{formatBs(p.precio_base)}</span>
                </div>
                <div className="lote__lider">
                  <span className="lote__etiqueta">Abre el</span>
                  <span>{new Date(p.abre_en).toLocaleString("es-BO", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false })}</span>
                </div>
              </div>
              <button
                type="button"
                className={`btn ${avisar ? "btn--secondary" : "btn--primary"} lote__avisar`}
                aria-pressed={avisar}
                onClick={async () => {
                  if (!avisar && !(await pedirCuenta("Para avisarte cuando abra necesitamos tu cuenta."))) return;
                  await alternar(p.id);
                }}
              >
                {avisar ? "Te avisaremos cuando abra ✓" : "Avisarme cuando abra"}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function Cerradas({ lista }: { lista: Subasta[] }) {
  if (lista.length === 0) return <p className="filtros__vacio">Todavía no hay subastas cerradas.</p>;
  return (
    <div className="lotes" role="tabpanel" aria-label="Subastas cerradas">
      {lista.map((c) => {
        const final = c.puja_actual;
        return (
          <article key={c.id} className="lote">
            <div className="lote__visual">
              {c.imagen && <img src={c.imagen} alt={c.imagen_alt ?? ""} loading="lazy" decoding="async" />}
              <span className="lote__reloj">
                Cerró el {new Date(c.cierra_en).toLocaleDateString("es-BO", { day: "numeric", month: "long", year: "numeric" })}
              </span>
            </div>
            <div className="lote__cuerpo">
              <p className="lote__origen">
                {c.origen}
                {c.cantidad_kg ? ` · ${c.cantidad_kg.toLocaleString("es-BO")} kg` : ""}
              </p>
              <h2 className="lote__titulo">{c.titulo}</h2>
              <div className="lote__puja">
                <div>
                  <span className="lote__etiqueta">{final ? "Precio final" : "Precio de salida"}</span>
                  <span className="lote__monto">{formatBs(final ?? c.precio_base)}</span>
                </div>
                <div className="lote__lider">
                  <span className="lote__etiqueta">{c.num_pujas === 1 ? "1 puja" : `${c.num_pujas} pujas`}</span>
                  {final && <span>+{Math.round((final / c.precio_base - 1) * 100)} % sobre la salida</span>}
                </div>
              </div>
              <p className="lote__resultado">
                {c.ganador_nombre
                  ? `Ganó ${c.ganador_nombre}. Salió en ${formatBs(c.precio_base)}.`
                  : "Cerró sin pujas: el lote no se adjudicó."}
              </p>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function ComoFunciona() {
  const pasos = [
    ["Regístrate", "Crea tu cuenta para pujar. Puedes ser una cafetería, un tostador o un amante del café."],
    ["Puja", "Cada puja debe superar a la anterior en al menos Bs. 20. Ves en vivo quién va primero."],
    ["Te avisamos", "Si alguien te supera, te avisamos al momento para que decidas si vuelves a pujar."],
    ["Ganas y pagas", "Al cerrar, gana la puja más alta. Generamos tu orden de compra y coordinamos el envío."],
  ];
  return (
    <section className="section" aria-labelledby="sub-como-titulo">
      <div className="wrap">
        <div className="head" data-revelar>
          <h2 id="sub-como-titulo">Cómo funciona una subasta</h2>
          <div>
            <p>Lotes pequeños y únicos: cuando se venden, no vuelven a la tienda.</p>
          </div>
        </div>
        <ol className="pasos pasos--4">
          {pasos.map(([t, d], i) => (
            <li key={t} className={`paso ${i % 2 ? "desde-der" : "desde-izq"}`} data-revelar style={{ "--i": i } as React.CSSProperties}>
              <span className="paso__num">0{i + 1}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
