"use client";

/* eslint-disable @next/next/no-img-element -- export estático: next/image no optimiza aquí */
import Link from "next/link";
import { useState } from "react";
import { Cerradas, ComoFunciona, Pestanas, Proximas, type Pestana } from "./SubastasExtra";
import { AvisoSubasta, useSubastasEnVivo } from "./EnVivo";
import Escenario from "./Escenario";
import PanelPuja, { MontoVivo, Podio, Reloj } from "./PanelPuja";
import { colorLote } from "./colorLote";
import { Onda } from "@/components/club/PlanesClub";
import { abierta, useSubastas, type Subasta } from "@/store/subastasStore";

/**
 * Subastas de micro-lotes en vivo (RF-10 a RF-16). Los lotes, las pujas y el cierre viven en
 * Supabase: cada puja pasa por realizar_puja() (bloquea el lote, RNF-09) y Realtime avisa a
 * todos los navegadores al instante. La subasta se cierra sola (pg_cron) con un solo ganador.
 */

export default function Subastas() {
  useSubastasEnVivo();
  const { subastas, cargando, error, ahora } = useSubastas();
  const [pestana, setPestana] = useState<Pestana>("vivo");

  // En vivo: activas que aún no vencen (y las recién vencidas hasta que el cierre las mueva).
  const enVivo = subastas.filter((s) => s.estado === "activa" || (s.estado === "proxima" && new Date(s.abre_en).getTime() <= ahora));
  const proximas = subastas.filter((s) => s.estado === "proxima" && new Date(s.abre_en).getTime() > ahora);
  const cerradas = subastas.filter((s) => s.estado === "cerrada").reverse();

  return (
    <>
      <Escenario />
      <section className="section subastas" aria-label="Lotes en subasta">
        <div className="wrap">
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
              <div className={`slotes${enVivo.length < 3 ? " slotes--pocos" : ""}`} role="tabpanel" aria-label="Subastas en vivo">
                {enVivo.map((a) => <LoteVivo key={a.id} lote={a} ahora={ahora} />)}
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

/** Foto con borde ondulado, reloj encima. */
export function FotoLote({ lote, children, enlace = true }: { lote: Subasta; children?: React.ReactNode; enlace?: boolean }) {
  const foto = lote.imagen && <img src={lote.imagen} alt={lote.imagen_alt ?? ""} loading="lazy" decoding="async" />;
  return (
    <div className="slote__foto">
      {enlace ? <Link href={`/subastas/lote?l=${lote.id}`} aria-label={`Ver la ficha de ${lote.titulo}`}>{foto}</Link> : foto}
      {children}
      <Onda />
    </div>
  );
}

/** Medalla con el puntaje de catación (solo café de especialidad: 80 o más). */
export function Medalla({ puntaje }: { puntaje: number | null }) {
  if (!puntaje || puntaje < 80) return null;
  return (
    <span className="slote__medalla" title="Puntaje de catación">
      <strong>{puntaje.toLocaleString("es-BO", { maximumFractionDigits: 1 })}</strong>
      <small>puntos</small>
    </span>
  );
}

export const datosLote = (a: Subasta) =>
  [a.origen, a.altitud ? `${a.altitud.toLocaleString("es-BO")} msnm` : null, a.cantidad_kg ? `${a.cantidad_kg.toLocaleString("es-BO")} kg` : null].filter(Boolean).join(" · ");

function LoteVivo({ lote: a, ahora }: { lote: Subasta; ahora: number }) {
  const cerrada = !abierta(a, ahora);
  const color = colorLote(a);
  return (
    <article className={`slote${cerrada ? " is-cerrada" : ""}`} style={{ "--cc": color } as React.CSSProperties}>
      <FotoLote lote={a}>
        <Medalla puntaje={a.puntaje} />
        {cerrada ? <span className="slote__cerrando">Cerrando…</span> : <Reloj hasta={a.cierra_en} ahora={ahora} texto="Cierra en" />}
      </FotoLote>

      <div className="slote__cuerpo">
        <p className="slote__datos">{datosLote(a)}</p>
        <h2><Link href={`/subastas/lote?l=${a.id}`}>{a.titulo}</Link></h2>
        <p className="slote__desc">{a.descripcion}</p>

        <div className="puja-actual">
          <span>{a.num_pujas ? `Puja actual · ${a.num_pujas === 1 ? "1 puja" : `${a.num_pujas} pujas`}` : "Precio de salida"}</span>
          <strong><MontoVivo valor={a.puja_actual ?? a.precio_base} /></strong>
          <small>Sube de {a.incremento.toLocaleString("es-BO")} en {a.incremento.toLocaleString("es-BO")}</small>
        </div>
        <Podio id={a.id} />
        <PanelPuja lote={a} />
      </div>
    </article>
  );
}
