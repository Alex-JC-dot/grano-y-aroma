"use client";

/* eslint-disable @next/next/no-img-element -- export estático: next/image no optimiza aquí */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { mensajeDeError, supabase } from "@/lib/supabase";
import { formatBs } from "@/lib/utils";
import type { FilaProducto } from "@/store/catalogoStore";
import type { Categoria } from "@/lib/types";

/**
 * Productos del administrador (RF-01, RF-05, RF-21): agregar productos a la tienda o a la
 * barra, cambiar precio y stock, y ocultarlos sin borrarlos. La tienda los toma de aquí al
 * instante (Realtime). Solo el admin puede escribir en el catálogo (RLS).
 */

const CATEGORIAS: { v: Categoria; label: string }[] = [
  { v: "grano", label: "Café en grano" },
  { v: "molido", label: "Café molido" },
  { v: "jarabe", label: "Jarabe" },
  { v: "equipo", label: "Equipo" },
  { v: "accesorio", label: "Accesorio" },
  { v: "bebida", label: "Barra (solo caja)" },
];
const GRUPOS = ["Bebidas calientes", "Métodos", "Bebidas frías", "Pastelería", "Otros"];
const FOTOS = [
  "", "/images/tienda/frasco.webp", "/images/tienda/jarabe.webp", "/images/tienda/vaso.webp", "/images/tienda/mandil.webp",
  "/images/tienda/vasos-papel.webp", "/images/tienda/taza.webp", "/images/tienda/vasos-marca.webp", "/images/tienda/kit-llevar.webp",
  "/images/tienda/cafetera-goteo.webp", "/images/tienda/cafetera-espresso.webp", "/images/tienda/moka.webp",
];
const COLORES = ["#b5603f", "#5f6b3a", "#c4952f", "#3a3532", "#7a2e35", "#5d7b95", "#7a4a2c"];
const MOLIENDAS_CAFE = "Grano Entero, Espresso, V60, Moka";

type Fila = FilaProducto;
const esCafe = (c: Categoria) => c === "grano" || c === "molido";

const vacio = () => ({
  nombre: "",
  categoria: "grano" as Categoria,
  descripcion: "",
  presentacion: "Bolsa de 250 g",
  precio: "",
  stock: "",
  origen: "",
  region: "",
  altitud: "",
  tueste: "Medio",
  perfil: "",
  codigo_lote: "",
  puntaje: "",
  moliendas: MOLIENDAS_CAFE,
  foto: "",
  color: COLORES[0],
  grupo: GRUPOS[0],
});
type Form = ReturnType<typeof vacio>;

export default function PaginaProductos() {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<Categoria | "todos">("todos");
  const [cambios, setCambios] = useState<Record<string, { precio?: string; stock?: string }>>({});
  const [guardando, setGuardando] = useState<string | null>(null);
  const [f, setF] = useState<Form>(vacio);
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  const cargar = useCallback(async () => {
    const { data } = await supabase.from("productos").select("*").order("categoria").order("orden").order("creado_en");
    setFilas(((data as Fila[]) ?? []).map((x) => ({ ...x, precio: Number(x.precio) })));
    setCargando(false);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(cargar, 0);
    return () => window.clearTimeout(t);
  }, [cargar]);

  const guardarFila = async (p: Fila) => {
    const c = cambios[p.id];
    if (!c) return;
    const precio = c.precio != null ? Number(c.precio.replace(",", ".")) : p.precio;
    const stock = c.stock != null ? Math.floor(Number(c.stock)) : p.stock;
    if (!(precio >= 0) || !(stock >= 0)) return setAviso("Precio y stock deben ser números de 0 para arriba.");
    setGuardando(p.id);
    const { error } = await supabase.from("productos").update({ precio, stock }).eq("id", p.id);
    setGuardando(null);
    if (error) return setAviso(mensajeDeError(error));
    setFilas((xs) => xs.map((x) => (x.id === p.id ? { ...x, precio, stock } : x)));
    setCambios((x) => {
      const n = { ...x };
      delete n[p.id];
      return n;
    });
    setAviso(`Guardado: ${p.nombre}.`);
  };

  const alternarActivo = async (p: Fila) => {
    setGuardando(p.id);
    await supabase.from("productos").update({ activo: !p.activo }).eq("id", p.id);
    setFilas((xs) => xs.map((x) => (x.id === p.id ? { ...x, activo: !p.activo } : x)));
    setGuardando(null);
    setAviso(p.activo ? `${p.nombre} ya no se ve en la tienda.` : `${p.nombre} vuelve a la tienda.`);
  };

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const precio = Number(f.precio.replace(",", "."));
    const stock = Math.floor(Number(f.stock || "0"));
    if (!f.nombre.trim()) return setError("Escribe el nombre del producto.");
    if (!(precio > 0)) return setError("El precio debe ser mayor que cero.");
    if (!(stock >= 0)) return setError("El stock debe ser 0 o más.");
    const cafe = esCafe(f.categoria);
    if (cafe && (!f.origen.trim() || !f.region.trim())) return setError("Para un café, escribe el origen (departamento) y la región.");
    const n = (v: string) => (v.trim() ? Number(v.replace(",", ".")) : null);

    const fila = {
      nombre: f.nombre.trim(),
      categoria: f.categoria,
      descripcion: f.descripcion.trim(),
      presentacion: f.presentacion.trim() || null,
      precio,
      stock,
      origen: cafe ? f.origen.trim() : null,
      region: cafe ? f.region.trim() : null,
      altitud: cafe ? n(f.altitud) : null,
      tueste: cafe ? f.tueste : null,
      perfil: cafe ? f.perfil.split(",").map((x) => x.trim()).filter(Boolean) : null,
      codigo_lote: cafe ? f.codigo_lote.trim() || null : null,
      puntaje: cafe ? n(f.puntaje) : null,
      fecha_tueste: cafe ? new Date().toISOString().slice(0, 10) : null,
      moliendas: cafe ? f.moliendas.split(",").map((x) => x.trim()).filter(Boolean) : ["Única"],
      foto: !cafe && f.foto ? { src: f.foto } : null,
      color: cafe ? f.color : null,
      grupo: f.categoria === "bebida" ? f.grupo : null,
    };
    setGuardando("nuevo");
    const { error } = await supabase.from("productos").insert(fila);
    setGuardando(null);
    if (error) return setError(/row-level security/i.test(error.message) ? "Solo el administrador puede agregar productos." : mensajeDeError(error));
    setAviso(`Agregaste ${fila.nombre}. ${f.categoria === "bebida" ? "Ya aparece en la caja." : "Ya aparece en la tienda."}`);
    setF(vacio());
    setAbierto(false);
    cargar();
  };

  const cambiar = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value }));

  const visibles = filas.filter((p) => filtro === "todos" || p.categoria === filtro);
  const cafe = esCafe(f.categoria);

  return (
    <div className="equipo__pagina">
      <div className="equipo__cabeza">
        <div>
          <p className="eyebrow">Administración</p>
          <h1>Productos y stock</h1>
        </div>
        <div className="equipo__fila">
          <Link href="/tienda" className="btn btn--secondary">Ver la tienda</Link>
          <button type="button" className="btn btn--primary" aria-expanded={abierto} onClick={() => { setAbierto((a) => !a); setError(""); }}>
            {abierto ? "Cerrar formulario" : "Agregar producto"}
          </button>
        </div>
      </div>

      {abierto && (
        <form className="panel admin-sub" onSubmit={crear} noValidate style={{ marginBottom: 24 }}>
          <h2>Nuevo producto</h2>
          <fieldset>
            <legend>Datos</legend>
            <div className="admin-sub__grid">
              <Campo id="p-nombre" etiqueta="Nombre *" ancho>
                <input id="p-nombre" value={f.nombre} onChange={cambiar("nombre")} />
              </Campo>
              <Campo id="p-cat" etiqueta="Categoría">
                <select id="p-cat" className="tueste-form__select" value={f.categoria} onChange={cambiar("categoria")}>
                  {CATEGORIAS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
                </select>
              </Campo>
              {f.categoria === "bebida" ? (
                <Campo id="p-grupo" etiqueta="Grupo en la caja">
                  <select id="p-grupo" className="tueste-form__select" value={f.grupo} onChange={cambiar("grupo")}>
                    {GRUPOS.map((g) => <option key={g}>{g}</option>)}
                  </select>
                </Campo>
              ) : (
                <Campo id="p-pres" etiqueta="Presentación">
                  <input id="p-pres" value={f.presentacion} onChange={cambiar("presentacion")} placeholder="Bolsa de 250 g" />
                </Campo>
              )}
              <Campo id="p-precio" etiqueta="Precio (Bs.) *">
                <input id="p-precio" type="number" inputMode="decimal" value={f.precio} onChange={cambiar("precio")} />
              </Campo>
              <Campo id="p-stock" etiqueta="Stock inicial">
                <input id="p-stock" type="number" inputMode="numeric" value={f.stock} onChange={cambiar("stock")} placeholder="0" />
              </Campo>
              {f.categoria !== "bebida" && (
                <Campo id="p-desc" etiqueta={cafe ? "Notas de cata" : "Descripción"} ancho>
                  <textarea id="p-desc" rows={2} value={f.descripcion} onChange={cambiar("descripcion")} />
                </Campo>
              )}
            </div>
          </fieldset>

          {cafe && (
            <fieldset>
              <legend>Origen y trazabilidad</legend>
              <div className="admin-sub__grid">
                <Campo id="p-origen" etiqueta="Departamento *">
                  <input id="p-origen" value={f.origen} onChange={cambiar("origen")} placeholder="Chuquisaca" />
                </Campo>
                <Campo id="p-region" etiqueta="Región *">
                  <input id="p-region" value={f.region} onChange={cambiar("region")} placeholder="Villa Serrano" />
                </Campo>
                <Campo id="p-alt" etiqueta="Altitud (msnm)">
                  <input id="p-alt" type="number" value={f.altitud} onChange={cambiar("altitud")} />
                </Campo>
                <Campo id="p-tueste" etiqueta="Tueste">
                  <select id="p-tueste" className="tueste-form__select" value={f.tueste} onChange={cambiar("tueste")}>
                    {["Ligero", "Medio", "Oscuro"].map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Campo>
                <Campo id="p-perfil" etiqueta="Perfil de sabor (separado por comas)">
                  <input id="p-perfil" value={f.perfil} onChange={cambiar("perfil")} placeholder="Frutal, Floral, Cítrico" />
                </Campo>
                <Campo id="p-punt" etiqueta="Puntaje de catación">
                  <input id="p-punt" type="number" step="0.25" value={f.puntaje} onChange={cambiar("puntaje")} placeholder="86,5" />
                </Campo>
                <Campo id="p-lote" etiqueta="Código de lote">
                  <input id="p-lote" value={f.codigo_lote} onChange={cambiar("codigo_lote")} placeholder="VS-2025-NAT-002" />
                </Campo>
                <Campo id="p-mol" etiqueta="Moliendas (separadas por comas)">
                  <input id="p-mol" value={f.moliendas} onChange={cambiar("moliendas")} />
                </Campo>
              </div>
            </fieldset>
          )}

          {cafe ? (
            <fieldset>
              <legend>Color de la etiqueta</legend>
              <div className="equipo__fila" role="radiogroup" aria-label="Color de la etiqueta">
                {COLORES.map((c) => (
                  <label key={c} className={`admin-prod__color${f.color === c ? " is-on" : ""}`} style={{ background: c }}>
                    <input type="radio" name="color" value={c} checked={f.color === c} onChange={cambiar("color")} className="sr-only" />
                    <span className="sr-only">{c}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : f.categoria !== "bebida" && (
            <fieldset>
              <legend>Foto</legend>
              <div className="admin-sub__fotos" role="radiogroup" aria-label="Foto del producto">
                {FOTOS.map((src) => (
                  <label key={src || "ninguna"} className={`admin-sub__foto${f.foto === src ? " is-on" : ""}`}>
                    <input type="radio" name="foto" value={src} checked={f.foto === src} onChange={cambiar("foto")} className="sr-only" />
                    {src ? <img src={src} alt="" loading="lazy" /> : <span className="admin-prod__sinfoto">Sin foto</span>}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {error && <p className="carrito__error" role="alert">{error}</p>}
          <button type="submit" className="btn btn--primary" disabled={guardando === "nuevo"}>
            {guardando === "nuevo" ? "Guardando…" : "Agregar producto"}
          </button>
        </form>
      )}

      <div className="equipo__acciones">
        <div className="filtros__opciones" role="group" aria-label="Categoría">
          {[{ v: "todos" as const, label: "Todo" }, ...CATEGORIAS].map((c) => (
            <button key={c.v} type="button" className={`chip${filtro === c.v ? " is-on" : ""}`} aria-pressed={filtro === c.v} onClick={() => setFiltro(c.v)}>
              {c.label}
            </button>
          ))}
        </div>
        <p className="equipo__aviso" role="status">{aviso}</p>
      </div>

      {cargando ? (
        <p className="caja__vacia" aria-busy="true">Cargando productos…</p>
      ) : (
        <div className="tabla-marco">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Producto</th>
                <th scope="col" className="num">Precio (Bs.)</th>
                <th scope="col" className="num">Stock</th>
                <th scope="col">Estado</th>
                <th scope="col"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((p) => {
                const c = cambios[p.id];
                const bajo = p.stock <= p.stock_minimo;
                return (
                  <tr key={p.id} className={p.activo ? "" : "is-inactivo"}>
                    <td>
                      {p.nombre}
                      <small>{CATEGORIAS.find((x) => x.v === p.categoria)?.label}{p.codigo_lote ? ` · ${p.codigo_lote}` : ""}</small>
                    </td>
                    <td className="num">
                      <input
                        className="admin-prod__num"
                        type="number"
                        inputMode="decimal"
                        aria-label={`Precio de ${p.nombre}`}
                        value={c?.precio ?? String(p.precio)}
                        onChange={(e) => setCambios((x) => ({ ...x, [p.id]: { ...x[p.id], precio: e.target.value } }))}
                      />
                    </td>
                    <td className="num">
                      <input
                        className="admin-prod__num"
                        type="number"
                        inputMode="numeric"
                        aria-label={`Stock de ${p.nombre}`}
                        value={c?.stock ?? String(p.stock)}
                        onChange={(e) => setCambios((x) => ({ ...x, [p.id]: { ...x[p.id], stock: e.target.value } }))}
                      />
                    </td>
                    <td>
                      <span className={`estado ${!p.activo ? "estado--pausada" : p.stock <= 0 ? "estado--pausada" : bajo ? "estado--recibido" : ""}`}>
                        {!p.activo ? "Oculto" : p.stock <= 0 ? "Agotado" : bajo ? "Stock bajo" : "A la venta"}
                      </span>
                    </td>
                    <td>
                      <div className="equipo__fila admin-sub__acciones">
                        {c && (
                          <button type="button" className="link" disabled={guardando === p.id} onClick={() => guardarFila(p)}>
                            Guardar
                          </button>
                        )}
                        <button type="button" className="link" disabled={guardando === p.id} onClick={() => alternarActivo(p)}>
                          {p.activo ? "Ocultar" : "Mostrar"}
                        </button>
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
        Los cambios se ven al instante en la tienda. Ocultar un producto no lo borra: sigue en los pedidos que ya se hicieron. Precio total del inventario a la venta:{" "}
        {formatBs(filas.filter((p) => p.activo && p.categoria !== "bebida").reduce((s, p) => s + p.precio * p.stock, 0))}.
      </p>
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
