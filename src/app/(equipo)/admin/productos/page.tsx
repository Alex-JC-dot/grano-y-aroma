"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { mensajeDeError, supabase } from "@/lib/supabase";
import { formatBs } from "@/lib/utils";
import type { FilaProducto } from "@/store/catalogoStore";
import type { Categoria } from "@/lib/types";
import SelectorFoto from "@/components/equipo/SelectorFoto";
import { subirFoto } from "@/lib/archivos";
import { GALERIA_TOTEM } from "@/lib/totem";

/**
 * Productos del administrador (RF-01, RF-05, RF-21): agregar productos a la tienda o a la
 * barra, editarlos (el mismo formulario, con los datos actuales ya cargados), cambiar precio
 * y stock desde la tabla, y ocultarlos sin borrarlos. El interruptor "Tótem" decide si cada
 * producto se ofrece en el autoservicio (migración 017). La tienda los toma de aquí al
 * instante (Realtime). Solo el admin puede escribir en el catálogo (RLS).
 */

const CATEGORIAS: { v: Categoria; label: string }[] = [
  { v: "grano", label: "Café en grano" },
  { v: "molido", label: "Café molido" },
  { v: "jarabe", label: "Jarabe" },
  { v: "equipo", label: "Equipo" },
  { v: "accesorio", label: "Accesorio" },
  { v: "bebida", label: "Barra (caja y tótem)" },
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
/** Lo que normalmente se ofrece en el tótem; el admin puede cambiarlo en cada producto. */
const vaAlTotem = (c: Categoria) => c === "bebida" || c === "grano";

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
  en_totem: true,
});
type Form = ReturnType<typeof vacio>;

/** El formulario con los datos actuales del producto: solo se cambia lo que se quiera. */
const desdeFila = (p: FilaProducto): Form => ({
  nombre: p.nombre,
  categoria: p.categoria,
  descripcion: p.descripcion ?? "",
  presentacion: p.presentacion ?? "",
  precio: String(p.precio),
  stock: String(p.stock),
  origen: p.origen ?? "",
  region: p.region ?? "",
  altitud: p.altitud == null ? "" : String(p.altitud),
  tueste: p.tueste ?? "Medio",
  perfil: (p.perfil ?? []).join(", "),
  codigo_lote: p.codigo_lote ?? "",
  puntaje: p.puntaje == null ? "" : String(p.puntaje),
  moliendas: p.moliendas?.length && !(p.moliendas.length === 1 && p.moliendas[0] === "Única") ? p.moliendas.join(", ") : MOLIENDAS_CAFE,
  foto: p.foto?.src ?? "",
  color: p.color ?? COLORES[0],
  grupo: p.grupo ?? GRUPOS[0],
  en_totem: p.en_totem ?? vaAlTotem(p.categoria),
});

export default function PaginaProductos() {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<Categoria | "todos" | "totem">("todos");
  const [cambios, setCambios] = useState<Record<string, { precio?: string; stock?: string }>>({});
  const [guardando, setGuardando] = useState<string | null>(null);
  const [f, setF] = useState<Form>(vacio);
  const [abierto, setAbierto] = useState(false);
  // Producto que se está editando (null = el formulario crea uno nuevo).
  const [editando, setEditando] = useState<Fila | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  // "Cambiar foto" en la tabla: un solo selector de archivo para la fila elegida.
  const archivoFila = useRef<HTMLInputElement>(null);
  const [filaFoto, setFilaFoto] = useState<Fila | null>(null);

  const cargar = useCallback(async () => {
    const { data } = await supabase.from("productos").select("*").order("categoria").order("orden").order("creado_en");
    setFilas(((data as Fila[]) ?? []).map((x) => ({ ...x, precio: Number(x.precio) })));
    setCargando(false);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(cargar, 0);
    return () => window.clearTimeout(t);
  }, [cargar]);

  // La columna llega con la 017: hasta entonces no se muestra ni se envía nada del tótem.
  const conTotem = filas.some((p) => p.en_totem !== undefined);

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

  const alternarTotem = async (p: Fila) => {
    const en_totem = !p.en_totem;
    setGuardando(p.id);
    const { error } = await supabase.from("productos").update({ en_totem }).eq("id", p.id);
    setGuardando(null);
    if (error) return setAviso(mensajeDeError(error));
    setFilas((xs) => xs.map((x) => (x.id === p.id ? { ...x, en_totem } : x)));
    setAviso(en_totem ? `${p.nombre} ya se ofrece en el tótem.` : `${p.nombre} ya no sale en el tótem.`);
  };

  const cambiarFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    const p = filaFoto;
    if (!archivo || !p) return;
    setGuardando(p.id);
    try {
      const src = await subirFoto(archivo, "productos");
      const foto = { src };
      const { error } = await supabase.from("productos").update({ foto }).eq("id", p.id);
      if (error) throw new Error(mensajeDeError(error));
      setFilas((xs) => xs.map((x) => (x.id === p.id ? { ...x, foto } : x)));
      setAviso(`Nueva foto para ${p.nombre}. Ya se ve en ${p.categoria === "bebida" ? "el tótem" : "la tienda"}.`);
    } catch (err) {
      setAviso(err instanceof Error ? err.message : "No se pudo cambiar la foto.");
    } finally {
      setGuardando(null);
      setFilaFoto(null);
    }
  };

  const abrirNuevo = () => {
    setEditando(null);
    setF(vacio());
    setError("");
    setAbierto(true);
  };

  const abrirEdicion = (p: Fila) => {
    setEditando(p);
    setF(desdeFila(p));
    setError("");
    setAbierto(true);
    // El formulario está arriba de la tabla: se lleva la vista hasta él.
    window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const cerrarFormulario = () => {
    setAbierto(false);
    setEditando(null);
    setF(vacio());
    setError("");
  };

  const guardar = async (e: React.FormEvent) => {
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
      // Al editar se conserva la fecha de tueste (la actualiza el registro de tueste en Bodega).
      fecha_tueste: cafe ? (editando?.fecha_tueste ?? new Date().toISOString().slice(0, 10)) : null,
      moliendas: cafe ? f.moliendas.split(",").map((x) => x.trim()).filter(Boolean) : ["Única"],
      // Si la foto no cambió se guarda tal cual (con su texto alternativo y demás datos).
      foto: f.foto ? (editando?.foto?.src === f.foto ? editando.foto : { src: f.foto }) : null,
      color: cafe ? f.color : null,
      grupo: f.categoria === "bebida" ? f.grupo : null,
      ...(conTotem ? { en_totem: f.en_totem } : {}),
    };
    setGuardando("nuevo");
    const { error } = editando
      ? await supabase.from("productos").update(fila).eq("id", editando.id)
      : await supabase.from("productos").insert(fila);
    setGuardando(null);
    if (error) {
      return setError(/row-level security/i.test(error.message) ? "Solo el administrador puede cambiar productos." : mensajeDeError(error));
    }
    if (editando) {
      setAviso(`Guardaste los cambios de ${fila.nombre}. Ya se ven en la ${f.categoria === "bebida" ? "caja" : "tienda"}.`);
      // Si en la tabla había un precio o stock sin guardar de este producto, ya no vale.
      setCambios((x) => {
        const nx = { ...x };
        delete nx[editando.id];
        return nx;
      });
    } else {
      setAviso(`Agregaste ${fila.nombre}. ${f.categoria === "bebida" ? "Ya aparece en la caja." : "Ya aparece en la tienda."}`);
    }
    cerrarFormulario();
    cargar();
  };

  // En un producto nuevo, al cambiar la categoría se sugiere si va o no al tótem.
  const cambiarCategoria = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const categoria = e.target.value as Categoria;
    setF((x) => ({ ...x, categoria, en_totem: editando ? x.en_totem : vaAlTotem(categoria) }));
  };

  const cambiar = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value }));

  const visibles = filas.filter((p) => filtro === "todos" || (filtro === "totem" ? p.en_totem && p.activo : p.categoria === filtro));
  const enTotem = filas.filter((p) => p.en_totem && p.activo).length;
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
          <button type="button" className="btn btn--primary" aria-expanded={abierto && !editando} onClick={abierto && !editando ? cerrarFormulario : abrirNuevo}>
            {abierto && !editando ? "Cerrar formulario" : "Agregar producto"}
          </button>
        </div>
      </div>

      {abierto && (
        <form ref={formRef} className="panel admin-sub" onSubmit={guardar} noValidate style={{ marginBottom: 24, scrollMarginTop: 24 }}>
          <h2>{editando ? `Editar: ${editando.nombre}` : "Nuevo producto"}</h2>
          {editando && <p className="caja__sub">Los datos actuales ya están cargados. Cambia solo lo que quieras y pulsa Guardar cambios.</p>}
          <fieldset>
            <legend>Datos</legend>
            <div className="admin-sub__grid">
              <Campo id="p-nombre" etiqueta="Nombre *" ancho>
                <input id="p-nombre" value={f.nombre} onChange={cambiar("nombre")} />
              </Campo>
              <Campo id="p-cat" etiqueta="Categoría">
                <select id="p-cat" className="tueste-form__select" value={f.categoria} onChange={cambiarCategoria}>
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
              <Campo id="p-stock" etiqueta={editando ? "Stock" : "Stock inicial"}>
                <input id="p-stock" type="number" inputMode="numeric" value={f.stock} onChange={cambiar("stock")} placeholder="0" />
              </Campo>
              <Campo id="p-desc" etiqueta={cafe ? "Notas de cata" : f.categoria === "bebida" ? "Descripción corta (se ve en el tótem)" : "Descripción"} ancho>
                <textarea id="p-desc" rows={2} value={f.descripcion} onChange={cambiar("descripcion")} />
              </Campo>
            </div>
            {conTotem && (
              <label className="admin-prod__totem">
                <input type="checkbox" checked={f.en_totem} onChange={(e) => setF((x) => ({ ...x, en_totem: e.target.checked }))} />
                <span>
                  <strong>Mostrar en el tótem</strong>
                  <small>Los clientes podrán pedirlo en la pantalla de autoservicio.</small>
                </span>
              </label>
            )}
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

          {cafe && (
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
          )}
          <fieldset>
            <legend>
              {cafe
                ? "Foto propia (opcional: si no subes una, se usa la bolsa con el color)"
                : f.categoria === "bebida"
                  ? "Foto para el tótem (mejor un PNG sin fondo; con Sin foto se usa la de su mismo nombre o un dibujo)"
                  : "Foto"}
            </legend>
            <SelectorFoto
              carpeta="productos"
              etiqueta="Foto del producto"
              valor={f.foto}
              galeria={cafe ? [] : f.categoria === "bebida" ? GALERIA_TOTEM : FOTOS.filter(Boolean).map((src) => ({ src }))}
              alCambiar={(src) => setF((x) => ({ ...x, foto: src }))}
              conSinFoto
            />
          </fieldset>

          {error && <p className="carrito__error" role="alert">{error}</p>}
          <div className="equipo__fila">
            <button type="submit" className="btn btn--primary" disabled={guardando === "nuevo"}>
              {guardando === "nuevo" ? "Guardando…" : editando ? "Guardar cambios" : "Agregar producto"}
            </button>
            <button type="button" className="btn btn--secondary" onClick={cerrarFormulario}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="equipo__acciones">
        <div className="filtros__opciones" role="group" aria-label="Categoría">
          {[{ v: "todos" as const, label: "Todo" }, ...(conTotem ? [{ v: "totem" as const, label: `En el tótem (${enTotem})` }] : []), ...CATEGORIAS].map((c) => (
            <button key={c.v} type="button" className={`chip${filtro === c.v ? " is-on" : ""}`} aria-pressed={filtro === c.v} onClick={() => setFiltro(c.v)}>
              {c.label}
            </button>
          ))}
        </div>
        <p className="equipo__aviso" role="status">{aviso}</p>
      </div>

      <input ref={archivoFila} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={cambiarFoto} />

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
                {conTotem && <th scope="col">Tótem</th>}
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
                    {conTotem && (
                      <td>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={!!p.en_totem}
                          aria-label={`Ofrecer ${p.nombre} en el tótem`}
                          className="interruptor"
                          disabled={guardando === p.id}
                          onClick={() => alternarTotem(p)}
                        />
                      </td>
                    )}
                    <td>
                      <div className="equipo__fila admin-sub__acciones">
                        {c && (
                          <button type="button" className="link" disabled={guardando === p.id} onClick={() => guardarFila(p)}>
                            Guardar
                          </button>
                        )}
                        <button type="button" className="link" disabled={guardando === p.id} onClick={() => abrirEdicion(p)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className="link"
                          disabled={guardando === p.id}
                          onClick={() => {
                            setFilaFoto(p);
                            archivoFila.current?.click();
                          }}
                        >
                          {guardando === p.id && filaFoto?.id === p.id ? "Subiendo…" : "Cambiar foto"}
                        </button>
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
