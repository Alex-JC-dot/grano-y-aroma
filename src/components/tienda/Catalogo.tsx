"use client";

import { useMemo, useState } from "react";
import { useProductos } from "@/store/catalogoStore";
import { CATEGORIAS, categoriaDe, esCafe, opcionesDeFiltro } from "@/lib/catalogo";
import TarjetaCafe from "./TarjetaCafe";

type IdCategoria = (typeof CATEGORIAS)[number]["id"];

/**
 * Catálogo con pestañas por categoría (café en grano, molido, jarabes, equipos, accesorios)
 * y, para el café, filtros por origen, tueste y perfil de sabor (RF-01).
 * Dentro de un grupo los filtros se suman (Chocolate o Frutal); entre grupos se combinan.
 */
export default function Catalogo() {
  const products = useProductos();
  const opciones = useMemo(() => opcionesDeFiltro(products), [products]);
  const [categoria, setCategoria] = useState<IdCategoria>("todos");
  const [origenes, setOrigenes] = useState<string[]>([]);
  const [tuestes, setTuestes] = useState<string[]>([]);
  const [perfiles, setPerfiles] = useState<string[]>([]);

  const muestraFiltrosCafe = categoria === "todos" || categoria === "grano" || categoria === "molido";
  const filtrosCafe = muestraFiltrosCafe ? origenes.length + tuestes.length + perfiles.length : 0;

  const alternar = (lista: string[], fijar: (v: string[]) => void, valor: string) =>
    fijar(lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]);

  const limpiar = () => {
    setOrigenes([]);
    setTuestes([]);
    setPerfiles([]);
  };

  const visibles = products.filter((p) => {
    if (categoria !== "todos" && categoriaDe(p) !== categoria) return false;
    if (!filtrosCafe) return true;
    // Con filtros de café activos solo quedan los cafés que los cumplen.
    return (
      esCafe(p) &&
      (!origenes.length || origenes.includes(p.origin)) &&
      (!tuestes.length || tuestes.includes(p.roastLevel)) &&
      (!perfiles.length || p.flavorProfile.some((f) => perfiles.includes(f)))
    );
  });

  const cuenta = (id: IdCategoria) => (id === "todos" ? products.length : products.filter((p) => categoriaDe(p) === id).length);

  const grupo = (titulo: string, valores: string[], activos: string[], fijar: (v: string[]) => void) => (
    <fieldset className="filtros__grupo">
      <legend>{titulo}</legend>
      <div className="filtros__opciones">
        {valores.map((v) => (
          <button key={v} type="button" className={`chip${activos.includes(v) ? " is-on" : ""}`} aria-pressed={activos.includes(v)} onClick={() => alternar(activos, fijar, v)}>
            {v}
          </button>
        ))}
      </div>
    </fieldset>
  );

  return (
    <>
      <div className="categorias" role="tablist" aria-label="Categorías" data-revelar>
        {CATEGORIAS.filter((c) => cuenta(c.id) > 0).map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={categoria === c.id}
            className={`categoria${categoria === c.id ? " is-on" : ""}`}
            onClick={() => setCategoria(c.id)}
          >
            {c.label} <span>{cuenta(c.id)}</span>
          </button>
        ))}
      </div>

      {muestraFiltrosCafe && (
        <div className="filtros">
          {grupo("Origen del café", opciones.origenes, origenes, setOrigenes)}
          {grupo("Tueste", opciones.tuestes, tuestes, setTuestes)}
          {grupo("Perfil de sabor", opciones.perfiles, perfiles, setPerfiles)}
        </div>
      )}

      <div className="filtros__resumen" aria-live="polite">
        <span>
          {visibles.length === 1 ? "1 producto" : `${visibles.length} productos`}
          {filtrosCafe ? " con estos filtros" : ""}
        </span>
        {filtrosCafe > 0 && (
          <button type="button" className="link filtros__limpiar" onClick={limpiar}>
            Quitar filtros
          </button>
        )}
      </div>

      {visibles.length ? (
        <div className="cards cards--3">
          {visibles.map((p, i) => (
            <TarjetaCafe key={p.id} producto={p} indice={i} revelar={false} />
          ))}
        </div>
      ) : (
        <p className="filtros__vacio">Ningún producto cumple todos esos filtros. Prueba quitando alguno.</p>
      )}
    </>
  );
}
