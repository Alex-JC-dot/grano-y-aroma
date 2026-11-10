"use client";

/* eslint-disable @next/next/no-img-element -- export estático: next/image no optimiza aquí */
import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatBs } from "@/lib/utils";
import { abierta, segundosA, useSubastas, type Subasta } from "@/store/subastasStore";
import { tiempo, useSubastasEnVivo } from "@/components/subastas/EnVivo";

/**
 * Subastas del administrador (RF-10, RF-15): publicar un lote, abrirlo o cerrarlo antes de
 * tiempo y ver cómo va cada uno en vivo. La base solo deja escribir aquí al rol admin (RLS).
 */

const IMAGENES = [
  { src: "/images/subastas/gesha.webp", alt: "Rama de cafeto con cerezas rojas maduras sobre un valle al amanecer" },
  { src: "/images/subastas/bourbon.webp", alt: "Cerezas de café secándose al sol en camas elevadas" },
  { src: "/images/subastas/reserva.webp", alt: "Muestra de café verde en una bandeja de madera junto a una lupa" },
  { src: "/images/subastas/cosecha.webp", alt: "Canasta de mimbre con cerezas de café rojas y amarillas entre los cafetos" },
  { src: "/images/subastas/pergamino.webp", alt: "Café en pergamino extendido en una cama de secado con un rastrillo de madera" },
  { src: "/images/subastas/catacion.webp", alt: "Taza de catación con una cuchara rompiendo la costra del café molido" },
  { src: "/images/subastas/entrega.webp", alt: "Saco pequeño de café verde con una etiqueta, listo para enviar junto a una caja" },
];

const ATRIBUTOS = ["Aroma", "Sabor", "Acidez", "Cuerpo", "Dulzor", "Final"];

/** Fecha local para <input type="datetime-local"> (YYYY-MM-DDTHH:mm). */
const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

const nuevoFormulario = () => ({
  titulo: "",
  descripcion: "",
  origen: "",
  altitud: "",
  cantidad_kg: "",
  puntaje: "",
  codigo_lote: "",
  variedad: "",
  proceso: "",
  cosecha: "",
  finca: "",
  historia: "",
  precio_base: "",
  incremento: "20",
  abre_en: local(new Date()),
  cierra_en: local(new Date(Date.now() + 48 * 3600 * 1000)),
  imagen: IMAGENES[0].src,
  catacion: Object.fromEntries(ATRIBUTOS.map((a) => [a, ""])) as Record<string, string>,
});

type Form = ReturnType<typeof nuevoFormulario>;

/** Si el cierre ya pasó, al abrir antes de tiempo se da 48 h de subasta. */
const cierreValido = (iso: string) =>
  new Date(iso).getTime() > Date.now() ? iso : new Date(Date.now() + 48 * 3600 * 1000).toISOString();

export default function PaginaSubastasAdmin() {
  useSubastasEnVivo();
  const { subastas, ahora, cargando } = useSubastas();
  const [f, setF] = useState<Form>(nuevoFormulario);
  const [error, setError] = useState("");
  const [listo, setListo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [ocupado, setOcupado] = useState<number | null>(null);

  const cambiar = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value }));

  const publicar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setListo("");
    const base = Number(f.precio_base);
    const abre = new Date(f.abre_en);
    const cierra = new Date(f.cierra_en);
    if (!f.titulo.trim()) return setError("Escribe el nombre del lote.");
    if (!f.origen.trim()) return setError("Escribe el origen (por ejemplo, Villa Serrano, Chuquisaca).");
    if (!base || base <= 0) return setError("El precio de salida debe ser mayor que cero.");
    if (!(Number(f.incremento) > 0)) return setError("El incremento mínimo debe ser mayor que cero.");
    if (isNaN(abre.getTime()) || isNaN(cierra.getTime())) return setError("Revisa las fechas de apertura y cierre.");
    if (cierra <= abre) return setError("El cierre tiene que ser después de la apertura.");
    if (cierra.getTime() <= Date.now()) return setError("El cierre tiene que ser en el futuro.");

    const notas = ATRIBUTOS.map((a) => [a, Number(f.catacion[a])] as [string, number]).filter(([, v]) => v > 0);
    if (notas.some(([, v]) => v < 6 || v > 10)) return setError("Las notas de catación van de 6 a 10.");
    const num = (v: string) => (v.trim() ? Number(v) : null);
    const txt = (v: string) => v.trim() || null;

    setEnviando(true);
    const { error } = await supabase.from("subastas").insert({
      titulo: f.titulo.trim(),
      descripcion: f.descripcion.trim(),
      origen: f.origen.trim(),
      altitud: num(f.altitud),
      cantidad_kg: num(f.cantidad_kg),
      puntaje: num(f.puntaje),
      codigo_lote: txt(f.codigo_lote),
      variedad: txt(f.variedad),
      proceso: txt(f.proceso),
      cosecha: txt(f.cosecha),
      finca: txt(f.finca),
      historia: txt(f.historia),
      imagen: f.imagen,
      imagen_alt: IMAGENES.find((i) => i.src === f.imagen)?.alt ?? null,
      catacion: notas.length >= 3 ? notas : null,
      precio_base: base,
      incremento: Number(f.incremento),
      abre_en: abre.toISOString(),
      cierra_en: cierra.toISOString(),
      estado: abre.getTime() <= Date.now() ? "activa" : "proxima",
    });
    setEnviando(false);
    if (error) return setError(/row-level security/i.test(error.message) ? "Solo el administrador puede publicar subastas." : error.message);
    setListo(`Publicaste "${f.titulo.trim()}". Ya aparece en la página de subastas.`);
    setF(nuevoFormulario());
  };

  const abrirAhora = async (s: Subasta) => {
    setOcupado(s.id);
    const ahoraIso = new Date().toISOString();
    const cierra = cierreValido(s.cierra_en);
    await supabase.from("subastas").update({ abre_en: ahoraIso, cierra_en: cierra, estado: "activa" }).eq("id", s.id);
    setOcupado(null);
  };

  const cerrarAhora = async (s: Subasta) => {
    if (!window.confirm(`¿Cerrar "${s.titulo}" ahora? ${s.lider_nombre ? `Gana ${s.lider_nombre} con ${formatBs(s.puja_actual ?? 0)}.` : "No tiene pujas."}`)) return;
    setOcupado(s.id);
    await supabase.from("subastas").update({ cierra_en: new Date().toISOString() }).eq("id", s.id);
    await supabase.rpc("cerrar_subastas_vencidas");
    setOcupado(null);
  };

  const eliminar = async (s: Subasta) => {
    if (!window.confirm(`¿Eliminar "${s.titulo}"? No se puede deshacer.`)) return;
    setOcupado(s.id);
    await supabase.from("subastas").delete().eq("id", s.id);
    setOcupado(null);
  };

  const estadoDe = (s: Subasta) => {
    if (s.estado === "cerrada") return { texto: "Cerrada", detalle: new Date(s.cierra_en).toLocaleDateString("es-BO", { day: "numeric", month: "short", year: "numeric" }) };
    if (abierta(s, ahora)) return { texto: "En vivo", detalle: `Cierra en ${tiempo(segundosA(s.cierra_en, ahora))}` };
    if (new Date(s.abre_en).getTime() > ahora) return { texto: "Próxima", detalle: `Abre en ${tiempo(segundosA(s.abre_en, ahora))}` };
    return { texto: "Cerrando…", detalle: "En menos de un minuto" };
  };

  return (
    <div className="equipo__pagina">
      <div className="equipo__cabeza">
        <div>
          <p className="eyebrow">Administración</p>
          <h1>Subastas</h1>
        </div>
        <Link href="/subastas" className="btn btn--secondary">Ver la página pública</Link>
      </div>

      <section className="panel" aria-labelledby="lotes-sub-titulo" style={{ marginBottom: 24 }}>
        <h2 id="lotes-sub-titulo">Lotes publicados</h2>
        {cargando ? (
          <p aria-busy="true">Cargando…</p>
        ) : subastas.length === 0 ? (
          <p>Todavía no hay subastas. Publica la primera abajo.</p>
        ) : (
          <div className="tabla-marco tabla-marco--plano">
            <table className="tabla">
              <thead>
                <tr>
                  <th scope="col">Lote</th>
                  <th scope="col">Estado</th>
                  <th scope="col" className="num">Puja</th>
                  <th scope="col">Va primero / ganó</th>
                  <th scope="col"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {[...subastas].sort((a, b) => (a.estado === "cerrada" ? 1 : 0) - (b.estado === "cerrada" ? 1 : 0)).map((s) => {
                  const est = estadoDe(s);
                  const proxima = est.texto === "Próxima";
                  const vivo = est.texto === "En vivo";
                  return (
                    <tr key={s.id}>
                      <td>
                        <Link href={`/subastas/lote?l=${s.id}`} className="link">{s.titulo}</Link>
                        <small>{s.codigo_lote ?? "Sin código"} · salida {formatBs(s.precio_base)}</small>
                      </td>
                      <td>
                        {est.texto}
                        <small>{est.detalle}</small>
                      </td>
                      <td className="num">
                        {s.puja_actual ? formatBs(s.puja_actual) : "—"}
                        <small>{s.num_pujas === 1 ? "1 puja" : `${s.num_pujas} pujas`}</small>
                      </td>
                      <td>{s.ganador_nombre ?? s.lider_nombre ?? "—"}</td>
                      <td>
                        <div className="equipo__fila admin-sub__acciones">
                          {proxima && (
                            <button type="button" className="link" disabled={ocupado === s.id} onClick={() => abrirAhora(s)}>Abrir ahora</button>
                          )}
                          {vivo && (
                            <button type="button" className="link" disabled={ocupado === s.id} onClick={() => cerrarAhora(s)}>Cerrar ahora</button>
                          )}
                          {s.num_pujas === 0 && (
                            <button type="button" className="link admin-sub__borrar" disabled={ocupado === s.id} onClick={() => eliminar(s)}>Eliminar</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="caja__sub" style={{ marginTop: 16 }}>
          Las subastas se abren y se cierran solas a su hora (revisión cada minuto). Al cerrar, se crea la orden de compra del ganador.
        </p>
      </section>

      <section className="panel" aria-labelledby="nueva-sub-titulo">
        <h2 id="nueva-sub-titulo">Publicar un lote</h2>
        <form className="admin-sub" onSubmit={publicar} noValidate>
          <fieldset>
            <legend>El lote</legend>
            <div className="admin-sub__grid">
              <Campo id="s-titulo" etiqueta="Nombre del lote *" ancho>
                <input id="s-titulo" value={f.titulo} onChange={cambiar("titulo")} placeholder="Gesha Villa Serrano — Micro-lote" />
              </Campo>
              <Campo id="s-desc" etiqueta="Descripción corta" ancho>
                <textarea id="s-desc" rows={2} value={f.descripcion} onChange={cambiar("descripcion")} />
              </Campo>
              <Campo id="s-origen" etiqueta="Origen *">
                <input id="s-origen" value={f.origen} onChange={cambiar("origen")} placeholder="Villa Serrano, Chuquisaca" />
              </Campo>
              <Campo id="s-finca" etiqueta="Finca o productor">
                <input id="s-finca" value={f.finca} onChange={cambiar("finca")} />
              </Campo>
              <Campo id="s-alt" etiqueta="Altitud (msnm)">
                <input id="s-alt" type="number" inputMode="numeric" value={f.altitud} onChange={cambiar("altitud")} />
              </Campo>
              <Campo id="s-kg" etiqueta="Cantidad (kg)">
                <input id="s-kg" type="number" inputMode="decimal" step="0.5" value={f.cantidad_kg} onChange={cambiar("cantidad_kg")} />
              </Campo>
              <Campo id="s-var" etiqueta="Variedad">
                <input id="s-var" value={f.variedad} onChange={cambiar("variedad")} />
              </Campo>
              <Campo id="s-proc" etiqueta="Proceso">
                <input id="s-proc" value={f.proceso} onChange={cambiar("proceso")} placeholder="Natural, lavado, honey…" />
              </Campo>
              <Campo id="s-cos" etiqueta="Cosecha">
                <input id="s-cos" value={f.cosecha} onChange={cambiar("cosecha")} placeholder="Junio de 2025" />
              </Campo>
              <Campo id="s-cod" etiqueta="Código de lote">
                <input id="s-cod" value={f.codigo_lote} onChange={cambiar("codigo_lote")} placeholder="VS-2025-GES-002-AUC" />
              </Campo>
              <Campo id="s-hist" etiqueta="Historia del lote" ancho>
                <textarea id="s-hist" rows={3} value={f.historia} onChange={cambiar("historia")} />
              </Campo>
            </div>
          </fieldset>

          <fieldset>
            <legend>Foto</legend>
            <div className="admin-sub__fotos" role="radiogroup" aria-label="Foto del lote">
              {IMAGENES.map((i) => (
                <label key={i.src} className={`admin-sub__foto${f.imagen === i.src ? " is-on" : ""}`}>
                  <input type="radio" name="imagen" value={i.src} checked={f.imagen === i.src} onChange={cambiar("imagen")} className="sr-only" />
                  <img src={i.src} alt={i.alt} loading="lazy" />
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Catación (opcional, de 6 a 10)</legend>
            <div className="admin-sub__grid admin-sub__grid--6">
              <Campo id="s-punt" etiqueta="Puntaje total">
                <input id="s-punt" type="number" inputMode="decimal" step="0.25" value={f.puntaje} onChange={cambiar("puntaje")} placeholder="87,5" />
              </Campo>
              {ATRIBUTOS.map((a) => (
                <Campo key={a} id={`s-cat-${a}`} etiqueta={a}>
                  <input
                    id={`s-cat-${a}`}
                    type="number"
                    inputMode="decimal"
                    step="0.25"
                    min={6}
                    max={10}
                    value={f.catacion[a]}
                    onChange={(e) => setF((x) => ({ ...x, catacion: { ...x.catacion, [a]: e.target.value } }))}
                  />
                </Campo>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Precio y fechas</legend>
            <div className="admin-sub__grid">
              <Campo id="s-base" etiqueta="Precio de salida (Bs.) *">
                <input id="s-base" type="number" inputMode="decimal" value={f.precio_base} onChange={cambiar("precio_base")} />
              </Campo>
              <Campo id="s-inc" etiqueta="Cada puja sube al menos (Bs.)">
                <input id="s-inc" type="number" inputMode="decimal" value={f.incremento} onChange={cambiar("incremento")} />
              </Campo>
              <Campo id="s-abre" etiqueta="Abre">
                <input id="s-abre" type="datetime-local" value={f.abre_en} onChange={cambiar("abre_en")} />
              </Campo>
              <Campo id="s-cierra" etiqueta="Cierra">
                <input id="s-cierra" type="datetime-local" value={f.cierra_en} onChange={cambiar("cierra_en")} />
              </Campo>
            </div>
          </fieldset>

          {error && <p className="carrito__error" role="alert">{error}</p>}
          {listo && <p className="equipo__aviso" role="status">{listo}</p>}
          <button type="submit" className="btn btn--primary" disabled={enviando}>
            {enviando ? "Publicando…" : "Publicar subasta"}
          </button>
        </form>
      </section>
    </div>
  );
}

function Campo({ id, etiqueta, ancho, children }: { id: string; etiqueta: string; ancho?: boolean; children: React.ReactNode }) {
  return (
    <div className={`carrito__campo${ancho ? " admin-sub__ancho" : ""}`}>
      <label htmlFor={id}>{etiqueta}</label>
      {children}
    </div>
  );
}
