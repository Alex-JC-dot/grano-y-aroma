"use client";

import { useCallback, useEffect, useState } from "react";
import { mensajeDeError, supabase } from "@/lib/supabase";
import { formatBs } from "@/lib/utils";

/**
 * Bodega y tueste (RF-22 a RF-26), con Supabase:
 *  · Inventario: café verde, café tostado en la tienda (bolsas) e insumos, con alerta de mínimo.
 *  · Ingreso de café verde comprado al productor.
 *  · Registro de tueste: registrar_tueste() descuenta el verde, calcula la merma, genera el
 *    código de trazabilidad y suma las bolsas al stock de la tienda.
 */

type Verde = { id: number; codigo: string; nombre: string; origen: string | null; proveedor: string | null; kg: number; kg_minimo: number; costo_kg: number | null };
type Insumo = { id: number; nombre: string; cantidad: number; unidad: string; minimo: number };
type Tostado = { id: string; nombre: string; stock: number; stock_minimo: number; codigo_lote: string | null; categoria: string };
type Tueste = {
  id: number;
  codigo: string;
  kg_verde: number;
  kg_tostado: number;
  perfil: string | null;
  puntaje: number | null;
  notas: string | null;
  bolsas: number;
  creado_en: string;
  cafe_verde: { codigo: string; nombre: string } | null;
  productos: { nombre: string } | null;
};

const APTO_SUBASTA = 87; // puntaje mínimo para ofrecer un lote en subasta
const num = (v: string) => Number(v.replace(",", "."));

type FormTueste = { verde: string; kgVerde: string; kgTostado: string; perfil: string; puntaje: string; notas: string; producto: string; bolsas: string };
const TUESTE_VACIO: FormTueste = { verde: "", kgVerde: "", kgTostado: "", perfil: "", puntaje: "", notas: "", producto: "", bolsas: "" };
type FormVerde = { codigo: string; nombre: string; origen: string; proveedor: string; kg: string; costo: string };
const VERDE_VACIO: FormVerde = { codigo: "", nombre: "", origen: "", proveedor: "", kg: "", costo: "" };

export default function PaginaBodega() {
  const [pestana, setPestana] = useState<"inventario" | "tueste">("inventario");
  const [verdes, setVerdes] = useState<Verde[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [tostados, setTostados] = useState<Tostado[]>([]);
  const [tuestes, setTuestes] = useState<Tueste[]>([]);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState<"tueste" | "verde" | null>(null);
  const [ft, setFt] = useState<FormTueste>(TUESTE_VACIO);
  const [fv, setFv] = useState<FormVerde>(VERDE_VACIO);
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    const [v, i, t, tu] = await Promise.all([
      supabase.from("cafe_verde").select("*").order("codigo"),
      supabase.from("insumos").select("*").order("nombre"),
      supabase.from("productos").select("id, nombre, stock, stock_minimo, codigo_lote, categoria").in("categoria", ["grano", "molido"]).order("orden"),
      supabase.from("tuestes").select("*, cafe_verde(codigo, nombre), productos(nombre)").order("creado_en", { ascending: false }),
    ]);
    setVerdes(((v.data as Verde[]) ?? []).map((x) => ({ ...x, kg: Number(x.kg), kg_minimo: Number(x.kg_minimo) })));
    setInsumos(((i.data as Insumo[]) ?? []).map((x) => ({ ...x, cantidad: Number(x.cantidad), minimo: Number(x.minimo) })));
    setTostados((t.data as Tostado[]) ?? []);
    setTuestes(((tu.data as unknown as Tueste[]) ?? []).map((x) => ({ ...x, kg_verde: Number(x.kg_verde), kg_tostado: Number(x.kg_tostado), puntaje: x.puntaje == null ? null : Number(x.puntaje) })));
    setCargando(false);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(cargar, 0);
    return () => window.clearTimeout(t);
  }, [cargar]);

  const registrarTueste = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const v = verdes.find((x) => String(x.id) === ft.verde);
    const kgV = num(ft.kgVerde);
    const kgT = num(ft.kgTostado);
    const p = ft.puntaje.trim() ? num(ft.puntaje) : null;
    const bolsas = ft.bolsas.trim() ? Math.floor(num(ft.bolsas)) : 0;
    if (!v) return setError("Elige el lote de café verde.");
    if (!(kgV > 0)) return setError("Escribe los kilos de café verde que entraron a la tostadora.");
    if (kgV > v.kg) return setError(`Solo quedan ${v.kg} kg de ${v.nombre}.`);
    if (!(kgT > 0) || kgT > kgV) return setError("Los kilos tostados deben ser más de 0 y no más que el verde.");
    if (!ft.perfil.trim()) return setError("Describe el perfil: nivel, temperatura pico y tiempo.");
    if (p != null && !(p >= 60 && p <= 100)) return setError("El puntaje va de 60 a 100.");
    if (bolsas && !ft.producto) return setError("Elige a qué café de la tienda van las bolsas.");
    if (bolsas > Math.floor(kgT / 0.25)) return setError(`Con ${kgT} kg salen como máximo ${Math.floor(kgT / 0.25)} bolsas de 250 g.`);

    setEnviando(true);
    const { data, error } = await supabase.rpc("registrar_tueste", {
      p_verde: v.id,
      p_kg_verde: kgV,
      p_kg_tostado: kgT,
      p_perfil: ft.perfil.trim(),
      p_puntaje: p,
      p_notas: ft.notas.trim() || null,
      p_producto: ft.producto || null,
      p_bolsas: bolsas,
    });
    setEnviando(false);
    if (error) return setError(mensajeDeError(error));
    const merma = Math.round((1 - kgT / kgV) * 100);
    setAviso(`Lote ${data.codigo} registrado · merma ${merma} %${bolsas ? ` · ${bolsas} bolsas sumadas a la tienda` : ""}${p != null && p >= APTO_SUBASTA ? " · apto para subasta" : ""}.`);
    setFt(TUESTE_VACIO);
    setAbierto(null);
    cargar();
  };

  const ingresarVerde = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const kg = num(fv.kg);
    const codigo = fv.codigo.trim().toUpperCase();
    if (!/^[A-Z]{2,4}-\d{4}-GRN-\d{3}$/.test(codigo)) return setError("El código va así: VS-2025-GRN-013.");
    if (!fv.nombre.trim()) return setError("Escribe el nombre del café verde.");
    if (!(kg > 0)) return setError("Escribe los kilos que entraron.");
    setEnviando(true);
    const { error } = await supabase.from("cafe_verde").insert({
      codigo,
      nombre: fv.nombre.trim(),
      origen: fv.origen.trim() || null,
      proveedor: fv.proveedor.trim() || null,
      kg,
      costo_kg: fv.costo.trim() ? num(fv.costo) : null,
    });
    setEnviando(false);
    if (error) return setError(/duplicate|unique/i.test(error.message) ? "Ya existe un lote con ese código." : mensajeDeError(error));
    setAviso(`Ingresaron ${kg} kg de ${fv.nombre.trim()} (${codigo}).`);
    setFv(VERDE_VACIO);
    setAbierto(null);
    cargar();
  };

  const ajustarInsumo = async (i: Insumo, delta: number) => {
    const cantidad = Math.max(0, i.cantidad + delta);
    setInsumos((xs) => xs.map((x) => (x.id === i.id ? { ...x, cantidad } : x)));
    await supabase.from("insumos").update({ cantidad }).eq("id", i.id);
  };

  const filas = [
    ...verdes.map((v) => ({ key: `v${v.id}`, nombre: v.nombre, sub: `${v.codigo}${v.proveedor ? ` · ${v.proveedor}` : ""}`, tipo: "Café verde", cant: `${v.kg.toLocaleString("es-BO")} kg`, min: `${v.kg_minimo} kg`, bajo: v.kg <= v.kg_minimo, insumo: null as Insumo | null })),
    ...tostados.map((t) => ({ key: `t${t.id}`, nombre: t.nombre, sub: t.codigo_lote ?? "", tipo: "Café tostado (tienda)", cant: `${t.stock} bolsas`, min: `${t.stock_minimo} bolsas`, bajo: t.stock <= t.stock_minimo, insumo: null as Insumo | null })),
    ...insumos.map((i) => ({ key: `i${i.id}`, nombre: i.nombre, sub: "", tipo: "Insumo", cant: `${i.cantidad.toLocaleString("es-BO")} ${i.unidad}`, min: `${i.minimo} ${i.unidad}`, bajo: i.cantidad <= i.minimo, insumo: i })),
  ];
  const resumen = [
    { label: "Café verde", total: `${verdes.reduce((s, v) => s + v.kg, 0).toLocaleString("es-BO")} kg`, bajos: verdes.filter((v) => v.kg <= v.kg_minimo).length },
    { label: "Café tostado en tienda", total: `${tostados.reduce((s, t) => s + t.stock, 0)} bolsas`, bajos: tostados.filter((t) => t.stock <= t.stock_minimo).length },
    { label: "Insumos", total: `${insumos.length} productos`, bajos: insumos.filter((i) => i.cantidad <= i.minimo).length },
  ];

  const campo = (id: string, etiqueta: string, valor: string, fijar: (v: string) => void, ayuda = "", tipo = "text") => (
    <div className="carrito__campo">
      <label htmlFor={id}>{etiqueta}</label>
      <input id={id} type={tipo} inputMode={tipo === "number" ? "decimal" : undefined} value={valor} placeholder={ayuda} onChange={(e) => fijar(e.target.value)} />
    </div>
  );

  return (
    <div className="equipo__pagina">
      <div className="equipo__cabeza">
        <div>
          <p className="eyebrow">Producción e inventario</p>
          <h1>Bodega y tueste</h1>
        </div>
      </div>

      <div className="pestanas" role="tablist" aria-label="Secciones">
        {(["inventario", "tueste"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={pestana === t} className={pestana === t ? "is-on" : ""} onClick={() => { setPestana(t); setAbierto(null); setError(""); }}>
            {t === "inventario" ? "Inventario" : "Registro de tueste"}
          </button>
        ))}
      </div>

      <div className="equipo__acciones">
        <p className="equipo__aviso" role="status">{aviso}</p>
        {pestana === "inventario" ? (
          <button type="button" className="btn btn--primary" aria-expanded={abierto === "verde"} onClick={() => { setAbierto(abierto === "verde" ? null : "verde"); setError(""); }}>
            {abierto === "verde" ? "Cerrar formulario" : "Ingresar café verde"}
          </button>
        ) : (
          <button type="button" className="btn btn--primary" aria-expanded={abierto === "tueste"} onClick={() => { setAbierto(abierto === "tueste" ? null : "tueste"); setError(""); }}>
            {abierto === "tueste" ? "Cerrar formulario" : "Registrar tueste"}
          </button>
        )}
      </div>

      {abierto === "verde" && (
        <form className="panel tueste-form" onSubmit={ingresarVerde} noValidate>
          <h2>Ingreso de café verde</h2>
          <div className="tueste-form__grid">
            {campo("v-codigo", "Código del lote", fv.codigo, (x) => setFv((f) => ({ ...f, codigo: x })), "VS-2025-GRN-013")}
            {campo("v-nombre", "Nombre", fv.nombre, (x) => setFv((f) => ({ ...f, nombre: x })), "Café verde Villa Serrano")}
            {campo("v-origen", "Origen", fv.origen, (x) => setFv((f) => ({ ...f, origen: x })), "Villa Serrano, Chuquisaca")}
            {campo("v-prov", "Productor o proveedor", fv.proveedor, (x) => setFv((f) => ({ ...f, proveedor: x })))}
            {campo("v-kg", "Kilos que entraron", fv.kg, (x) => setFv((f) => ({ ...f, kg: x })), "60", "number")}
            {campo("v-costo", "Costo por kg (Bs.)", fv.costo, (x) => setFv((f) => ({ ...f, costo: x })), "45", "number")}
          </div>
          {error && <p className="carrito__error" role="alert">{error}</p>}
          <div className="equipo__fila">
            <button type="submit" className="btn btn--primary" disabled={enviando}>{enviando ? "Guardando…" : "Guardar ingreso"}</button>
            <button type="button" className="btn btn--secondary" onClick={() => setAbierto(null)}>Cancelar</button>
          </div>
        </form>
      )}

      {abierto === "tueste" && (
        <form className="panel tueste-form" onSubmit={registrarTueste} noValidate>
          <h2>Nuevo registro de tueste</h2>
          <div className="tueste-form__grid">
            <div className="carrito__campo">
              <label htmlFor="t-verde">Lote de café verde</label>
              <select id="t-verde" className="tueste-form__select" value={ft.verde} onChange={(e) => setFt((f) => ({ ...f, verde: e.target.value }))}>
                <option value="">Elige un lote</option>
                {verdes.filter((v) => v.kg > 0).map((v) => (
                  <option key={v.id} value={v.id}>{v.codigo} · {v.nombre} ({v.kg} kg)</option>
                ))}
              </select>
            </div>
            {campo("t-kgv", "Kilos de verde que entraron", ft.kgVerde, (x) => setFt((f) => ({ ...f, kgVerde: x })), "14", "number")}
            {campo("t-kgt", "Kilos tostados que salieron", ft.kgTostado, (x) => setFt((f) => ({ ...f, kgTostado: x })), "12", "number")}
            {campo("t-perfil", "Perfil de tueste", ft.perfil, (x) => setFt((f) => ({ ...f, perfil: x })), "Medio · 205 °C pico · 13:00 min")}
            {campo("t-punt", "Puntaje de catación", ft.puntaje, (x) => setFt((f) => ({ ...f, puntaje: x })), "87,5", "number")}
            <div className="carrito__campo">
              <label htmlFor="t-prod">Embolsar para la tienda (opcional)</label>
              <select id="t-prod" className="tueste-form__select" value={ft.producto} onChange={(e) => setFt((f) => ({ ...f, producto: e.target.value }))}>
                <option value="">No, queda en bodega</option>
                {tostados.map((t) => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </select>
            </div>
            {ft.producto && campo("t-bolsas", "Bolsas de 250 g", ft.bolsas, (x) => setFt((f) => ({ ...f, bolsas: x })), ft.kgTostado ? `máx. ${Math.floor(num(ft.kgTostado) / 0.25) || 0}` : "", "number")}
          </div>
          <div className="carrito__campo">
            <label htmlFor="t-notas">Notas de cata</label>
            <textarea id="t-notas" rows={2} value={ft.notas} onChange={(e) => setFt((f) => ({ ...f, notas: e.target.value }))} />
          </div>
          {num(ft.kgVerde) > 0 && num(ft.kgTostado) > 0 && num(ft.kgTostado) <= num(ft.kgVerde) && (
            <p className="caja__sub">Merma de este tueste: {Math.round((1 - num(ft.kgTostado) / num(ft.kgVerde)) * 100)} % (lo normal es entre 14 y 20 %).</p>
          )}
          {error && <p className="carrito__error" role="alert">{error}</p>}
          <p className="caja__sub">Al guardar se descuenta el café verde y se genera el código del lote tostado. Con {APTO_SUBASTA} puntos o más queda apto para subasta.</p>
          <div className="equipo__fila">
            <button type="submit" className="btn btn--primary" disabled={enviando}>{enviando ? "Guardando…" : "Guardar y generar código"}</button>
            <button type="button" className="btn btn--secondary" onClick={() => setAbierto(null)}>Cancelar</button>
          </div>
        </form>
      )}

      {cargando ? (
        <p className="caja__vacia" aria-busy="true">Cargando…</p>
      ) : pestana === "inventario" ? (
        <>
          <div className="tarjetas-dato">
            {resumen.map((r) => (
              <div key={r.label} className="dato">
                <span className="dato__label">{r.label}</span>
                <strong className="dato__valor">{r.total}</strong>
                <span className={`dato__nota${r.bajos ? " is-alerta" : ""}`}>{r.bajos ? `${r.bajos} bajo el mínimo` : "Todo en orden"}</span>
              </div>
            ))}
          </div>

          <div className="tabla-marco">
            <table className="tabla">
              <thead>
                <tr>
                  <th scope="col">Producto</th>
                  <th scope="col">Tipo</th>
                  <th scope="col" className="num">Stock</th>
                  <th scope="col" className="num">Mínimo</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.key}>
                    <td>
                      {f.nombre}
                      {f.sub && <small>{f.sub}</small>}
                    </td>
                    <td>{f.tipo}</td>
                    <td className="num">
                      {f.insumo ? (
                        <span className="bodega__ajuste">
                          <button type="button" className="link" aria-label={`Restar 1 a ${f.nombre}`} onClick={() => ajustarInsumo(f.insumo!, -1)}>−</button>
                          {f.cant}
                          <button type="button" className="link" aria-label={`Sumar 1 a ${f.nombre}`} onClick={() => ajustarInsumo(f.insumo!, 1)}>+</button>
                        </span>
                      ) : (
                        f.cant
                      )}
                    </td>
                    <td className="num">{f.min}</td>
                    <td><span className={`estado ${f.bajo ? "estado--pausada" : ""}`}>{f.bajo ? "Bajo stock" : "En orden"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : tuestes.length === 0 ? (
        <p className="caja__vacia">Todavía no hay tuestes registrados.</p>
      ) : (
        <ul className="registros">
          {tuestes.map((r) => {
            const merma = Math.round((1 - r.kg_tostado / r.kg_verde) * 100);
            return (
              <li key={r.id} className="registro">
                <div>
                  <p className="registro__meta">
                    {new Date(r.creado_en).toLocaleDateString("es-BO", { day: "numeric", month: "long", year: "numeric" })}
                    {r.puntaje != null && r.puntaje >= APTO_SUBASTA && <span className="estado">Apto para subasta</span>}
                  </p>
                  <h3>{r.codigo}</h3>
                  <p className="registro__detalle">
                    Verde {r.cafe_verde?.codigo ?? "—"} · {r.kg_verde} → {r.kg_tostado} kg (merma {merma} %){r.perfil ? ` · ${r.perfil}` : ""}
                  </p>
                  {r.bolsas > 0 && <p className="registro__detalle">{r.bolsas} bolsas a la tienda{r.productos ? `: ${r.productos.nombre}` : ""}</p>}
                  {r.notas && <p className="registro__notas">“{r.notas}”</p>}
                </div>
                {r.puntaje != null && (
                  <div className="registro__puntaje">
                    <strong>{r.puntaje.toLocaleString("es-BO", { minimumFractionDigits: 1 })}</strong>
                    <span>puntos</span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="caja__sub" style={{ marginTop: 24 }}>
        Costo del café verde en bodega: {formatBs(verdes.reduce((s, v) => s + v.kg * (v.costo_kg ?? 0), 0))}.
      </p>
    </div>
  );
}
