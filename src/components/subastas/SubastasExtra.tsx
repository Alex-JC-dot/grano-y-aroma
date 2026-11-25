"use client";

import { formatBs } from "@/lib/utils";
import { useAuth } from "@/store/authStore";
import { useSubastas, type Subasta } from "@/store/subastasStore";
import { Onda } from "@/components/club/PlanesClub";
import { Reloj } from "./PanelPuja";
import { datosLote, FotoLote, Medalla } from "./Subastas";

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
    <div className={`slotes${lista.length < 3 ? " slotes--pocos" : ""}`} role="tabpanel" aria-label="Próximas subastas">
      {lista.map((p) => {
        const avisar = avisos.has(p.id);
        return (
          <article key={p.id} className="slote">
            <FotoLote lote={p} enlace={false}>
              <Medalla puntaje={p.puntaje} />
              <Reloj hasta={p.abre_en} ahora={ahora} texto="Abre en" />
            </FotoLote>
            <div className="slote__cuerpo">
              <p className="slote__datos">{datosLote(p)}</p>
              <h2>{p.titulo}</h2>
              <p className="slote__desc">{p.descripcion}</p>
              <div className="puja-actual">
                <span>Precio de salida</span>
                <strong>{formatBs(p.precio_base)}</strong>
                <small>Abre el {new Date(p.abre_en).toLocaleString("es-BO", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false })}</small>
              </div>
              <button
                type="button"
                className="cplan__boton panel-puja__boton"
                aria-pressed={avisar}
                onClick={async () => {
                  if (!avisar && !(await pedirCuenta("Para avisarte cuando abra necesitamos tu cuenta."))) return;
                  await alternar(p.id);
                }}
              >
                {avisar ? "Te avisaremos ✓" : "Avisarme cuando abra"}
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
    <div className="slotes" role="tabpanel" aria-label="Subastas cerradas">
      {lista.map((c) => {
        const final = c.puja_actual;
        return (
          <article key={c.id} className="slote slote--cerrado">
            <FotoLote lote={c}>
              <span className="slote__cerrando">
                Cerró el {new Date(c.cierra_en).toLocaleDateString("es-BO", { day: "numeric", month: "long", year: "numeric" })}
              </span>
            </FotoLote>
            <div className="slote__cuerpo">
              <p className="slote__datos">{datosLote(c)}</p>
              <h2>{c.titulo}</h2>
              <div className="puja-actual">
                <span>{final ? "Precio final" : "Precio de salida"}</span>
                <strong>{formatBs(final ?? c.precio_base)}</strong>
                <small>
                  {c.num_pujas === 1 ? "1 puja" : `${c.num_pujas} pujas`}
                  {final ? ` · +${Math.round((final / c.precio_base - 1) * 100)} % sobre la salida` : ""}
                </small>
              </div>
              <p className="lote__resultado">
                {c.ganador_nombre ? `Ganó ${c.ganador_nombre}. Salió en ${formatBs(c.precio_base)}.` : "Cerró sin pujas: el lote no se adjudicó."}
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
    ["Puja", "Sube tu monto con un toque y puja. Ves en vivo quién va primero."],
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
        <ol className="spasos">
          {pasos.map(([t, d], i) => (
            <li key={t} className="copc spaso" data-revelar style={{ "--i": i } as React.CSSProperties}>
              <span className="copc__escena" aria-hidden="true"><span className="copc__num">{i + 1}</span><Onda /></span>
              <div className="copc__texto">
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
