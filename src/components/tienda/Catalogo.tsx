"use client";

import { useMemo, useState } from "react";
import { products } from "@/lib/data";
import { opcionesDeFiltro } from "@/lib/catalogo";
import TarjetaCafe from "./TarjetaCafe";

/**
 * Catálogo con filtros por origen, tueste y perfil de sabor (RF-01).
 * Dentro de un grupo los filtros se suman (Chocolate o Frutal); entre grupos se combinan
 * (de La Paz y además tueste medio).
 */
export default function Catalogo() {
  const opciones = useMemo(() => opcionesDeFiltro(products), []);
  const [origenes, setOrigenes] = useState<string[]>([]);
  const [tuestes, setTuestes] = useState<string[]>([]);
  const [perfiles, setPerfiles] = useState<string[]>([]);

  const alternar = (lista: string[], fijar: (v: string[]) => void, valor: string) =>
    fijar(lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]);

  const visibles = products.filter(
    (p) =>
      (!origenes.length || origenes.includes(p.origin)) &&
      (!tuestes.length || tuestes.includes(p.roastLevel)) &&
      (!perfiles.length || p.flavorProfile.some((f) => perfiles.includes(f))),
  );
  const hayFiltros = origenes.length + tuestes.length + perfiles.length > 0;

  const grupo = (titulo: string, valores: string[], activos: string[], fijar: (v: string[]) => void) => (
    <fieldset className="filtros__grupo">
      <legend>{titulo}</legend>
      <div className="filtros__opciones">
        {valores.map((v) => (
          <button
            key={v}
            type="button"
            className={`chip${activos.includes(v) ? " is-on" : ""}`}
            aria-pressed={activos.includes(v)}
            onClick={() => alternar(activos, fijar, v)}
          >
            {v}
          </button>
        ))}
      </div>
    </fieldset>
  );

  return (
    <>
      <div className="filtros" data-revelar>
        {grupo("Origen", opciones.origenes, origenes, setOrigenes)}
        {grupo("Tueste", opciones.tuestes, tuestes, setTuestes)}
        {grupo("Perfil de sabor", opciones.perfiles, perfiles, setPerfiles)}
      </div>

      <div className="filtros__resumen" aria-live="polite">
        <span>
          {visibles.length === 1 ? "1 café" : `${visibles.length} cafés`}
          {hayFiltros ? " con estos filtros" : ""}
        </span>
        {hayFiltros && (
          <button
            type="button"
            className="link filtros__limpiar"
            onClick={() => {
              setOrigenes([]);
              setTuestes([]);
              setPerfiles([]);
            }}
          >
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
        <p className="filtros__vacio">Ningún café cumple todos esos filtros. Prueba quitando alguno.</p>
      )}
    </>
  );
}
