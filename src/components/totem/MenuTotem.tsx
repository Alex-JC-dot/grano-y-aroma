"use client";
/* eslint-disable @next/next/no-img-element -- export estático: next/image no optimiza aquí */

import { useRef, useState } from "react";
import { formatBs } from "@/lib/utils";
import { descripcionDe, opcionesDe, POPULARES, precioCorto, rutaFoto, SECCIONES, seccionDe, textoOpciones, porDefecto, volarAlPedido, type ItemTotem, type LineaTotem } from "@/lib/totem";
import FotoTotem, { DibujoTotem } from "./FotoTotem";
import DetalleTotem from "./DetalleTotem";

/**
 * Menú del tótem: categorías con foto, populares, productos y la franja de "Mi pedido".
 *  · Tocar el producto lo expande (DetalleTotem); el botón + lo agrega directo, sin detalle.
 *  · Lo agregado vuela hasta la franja. "Ver mi pedido" abre el círculo desde ese botón.
 */
export default function MenuTotem({
  items,
  populares,
  orden,
  total,
  alAgregar,
  alCambiar,
  alVerPedido,
  alCancelar,
}: {
  items: ItemTotem[];
  /** Ids más vendidos (puede venir vacío). */
  populares: string[];
  orden: LineaTotem[];
  total: number;
  alAgregar: (item: ItemTotem, qty: number, opciones: string) => void;
  alCambiar: (clave: string, d: number) => void;
  alVerPedido: (origen: { x: number; y: number }) => void;
  alCancelar: () => void;
}) {
  const [seccion, setSeccion] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<{ item: ItemTotem; tarjeta: DOMRect; foto: DOMRect } | null>(null);
  const contenido = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLHeadingElement>(null);
  const destino = useRef<HTMLDivElement>(null);

  const secciones = SECCIONES.filter((s) => items.some((i) => seccionDe(i) === s.id));
  const enPedido = (id: string) => orden.filter((l) => l.item.id === id).reduce((s, l) => s + l.qty, 0);
  const unidades = orden.reduce((s, l) => s + l.qty, 0);

  // Populares: los más vendidos y, si faltan, los de la lista fija. Siempre seis, sin agotados.
  const candidatos = [...populares.map((id) => items.find((i) => i.id === id)), ...POPULARES.map((n) => items.find((i) => i.nombre === n))];
  const masPedidos = candidatos.filter((i, k): i is ItemTotem => !!i && i.stock > 0 && candidatos.indexOf(i) === k).slice(0, 6);
  const visibles = seccion ? items.filter((i) => seccionDe(i) === seccion) : masPedidos;
  const titulo = seccion ? SECCIONES.find((s) => s.id === seccion)!.nombre : "Populares";

  const elegirSeccion = (id: string) => {
    const nueva = seccion === id ? null : id;
    setSeccion(nueva);
    if (nueva) window.setTimeout(() => lista.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
    else contenido.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const abrir = (item: ItemTotem, tarjeta: HTMLElement) => {
    const foto = tarjeta.querySelector(".foto-totem__marco");
    if (!foto) return;
    setAbierto({ item, tarjeta: tarjeta.getBoundingClientRect(), foto: foto.getBoundingClientRect() });
  };

  const masUno = (item: ItemTotem, boton: HTMLElement) => {
    volarAlPedido(boton.closest(".tprod")?.querySelector(".foto-totem") ?? null, destino.current);
    alAgregar(item, 1, textoOpciones(item, porDefecto(item)));
  };

  return (
    <div className="totem tmenu">
      <div ref={contenido} className="tmenu__contenido">
        <header className="tmenu__cabeza">
          <span className="tmenu__logo" role="img" aria-label="Grano y Aroma" />
          <button type="button" className="tmenu__cancelar" onClick={alCancelar}>Cancelar</button>
        </header>

        <h1 className="tmenu__saludo"><strong>¡Hola!</strong> ¿Qué se te antoja hoy?</h1>

        <nav className="tcats" aria-label="Categorías">
          {secciones.map((s) => (
            <button key={s.id} type="button" className={`tcat${seccion === s.id ? " is-on" : ""}`} aria-pressed={seccion === s.id} onClick={() => elegirSeccion(s.id)}>
              <span className="tcat__foto">
                {s.foto ? <img src={rutaFoto(s.foto)} alt="" draggable={false} /> : <DibujoTotem tipo={s.dibujo} />}
              </span>
              <span>{s.nombre}</span>
            </button>
          ))}
        </nav>

        <h2 ref={lista} className="tmenu__titulo">{titulo}</h2>
        <div className="tprods" key={titulo}>
          {visibles.map((it, k) => {
            const en = enPedido(it.id);
            const agotado = it.stock <= 0;
            const lleno = en >= it.stock;
            return (
              <article key={it.id} className={`tprod${en ? " is-en" : ""}${agotado ? " is-agotado" : ""}`} style={{ animationDelay: `${Math.min(k, 8) * 45}ms` }}>
                <button type="button" className="tprod__abrir" disabled={agotado} onClick={(e) => abrir(it, e.currentTarget.closest<HTMLElement>(".tprod")!)}>
                  <span className="tprod__foto"><FotoTotem item={it} /></span>
                  <span className="tprod__nombre">{it.nombre}</span>
                  <span className="tprod__texto">{descripcionDe(it)}</span>
                  <span className="tprod__precio">{agotado ? "Agotado" : precioCorto(it.precio)}</span>
                </button>
                {!agotado && (
                  <button type="button" className="tprod__mas" disabled={lleno} aria-label={`Agregar ${it.nombre}`} onClick={(e) => masUno(it, e.currentTarget)}>
                    +
                  </button>
                )}
                {en > 0 && <span key={en} className="tprod__en">{en}</span>}
              </article>
            );
          })}
        </div>
      </div>

      <aside className="tfranja" aria-label="Mi pedido">
        <h2>Mi pedido</h2>
        <div ref={destino} className="tfranja__lista">
          {orden.length === 0 ? (
            <p className="tfranja__vacio">
              <DibujoTotem tipo="taza" />
              Toca un producto para empezar
            </p>
          ) : (
            [...orden].reverse().map((l) => (
              <div key={l.clave} className="tfranja__item">
                <FotoTotem item={l.item} />
                <span className="tfranja__nombre">{l.item.nombre}</span>
                {l.opciones && opcionesDe(l.item).length > 0 && <small>{l.opciones}</small>}
                <span className="tfranja__precio">{precioCorto(l.item.precio * l.qty)}</span>
                <span className="tfranja__qty">
                  <button type="button" aria-label={`Quitar uno de ${l.item.nombre}`} onClick={() => alCambiar(l.clave, -1)}>−</button>
                  <output>{l.qty}</output>
                  <button type="button" aria-label={`Agregar uno de ${l.item.nombre}`} disabled={enPedido(l.item.id) >= l.item.stock} onClick={() => alCambiar(l.clave, 1)}>+</button>
                </span>
              </div>
            ))
          )}
        </div>
        <div className="tfranja__pie">
          <span>Total</span>
          <strong>{formatBs(total)}</strong>
          <button
            type="button"
            className="tfranja__ver"
            disabled={!orden.length}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              alVerPedido({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
            }}
          >
            {unidades > 0 && <span key={unidades} className="tfranja__cuantos">{unidades}</span>}
            Ver mi pedido
          </button>
        </div>
      </aside>

      {abierto && (
        <DetalleTotem
          key={abierto.item.id}
          item={abierto.item}
          tarjeta={abierto.tarjeta}
          foto={abierto.foto}
          disponibles={abierto.item.stock - enPedido(abierto.item.id)}
          alAgregar={(qty, opciones) => alAgregar(abierto.item, qty, opciones)}
          alCerrar={() => setAbierto(null)}
        />
      )}
    </div>
  );
}
