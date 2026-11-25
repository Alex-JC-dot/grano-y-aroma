"use client";

import { useCallback, useEffect, useState } from "react";
import { mensajeDeError, supabase } from "@/lib/supabase";
import { codigoLote } from "@/lib/lotes";
import { formatBs } from "@/lib/utils";

/**
 * Proveedores y órdenes de compra (RF-27 a RF-29).
 *
 * Antes "proveedor" era un campo de texto suelto dentro del café verde: no había a quién
 * comprarle, ni forma de registrar qué se pidió, ni de que una recepción entrara sola a
 * bodega. Esta pantalla cierra ese circuito:
 *
 *   Proveedor → orden de compra con sus lotes → se envía → llega y se recibe → el café verde
 *   aparece en Bodega con su stock, su costo y su proveedor.
 *
 * Al recibir, la base suma los kilos al lote si el código ya existe, en vez de crear una fila
 * repetida (ver recibir_orden_compra en la migración 011). Comprarle dos veces el mismo lote
 * al mismo productor es lo normal en una tostaduría, y un listado con el mismo código tres
 * veces no sirve para saber cuánto café hay.
 */

type Proveedor = {
  id: number;
  nombre: string;
  contacto: string | null;
  telefono: string | null;
  correo: string | null;
  region: string | null;
  notas: string | null;
  activo: boolean;
};

type Item = { id: number; codigo: string; nombre: string; origen: string | null; kg: number; costo_kg: number };

type Orden = {
  id: number;
  codigo: string;
  estado: "borrador" | "enviada" | "recibida" | "cancelada";
  notas: string | null;
  creado_en: string;
  recibida_en: string | null;
  proveedores: { nombre: string } | null;
  orden_items: Item[];
};

const ESTADO_ORDEN: Record<Orden["estado"], string> = {
  borrador: "Borrador",
  enviada: "Enviada al proveedor",
  recibida: "Recibida en bodega",
  cancelada: "Cancelada",
};
const CLASE_ORDEN: Record<Orden["estado"], string> = {
  borrador: "estado--pausada",
  enviada: "estado--camino",
  recibida: "",
  cancelada: "estado--cancelada",
};

const PROV_VACIO = { nombre: "", contacto: "", telefono: "", correo: "", region: "", notas: "" };
const ITEM_VACIO = { nombre: "", origen: "", kg: "", costo_kg: "" };

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-BO", { day: "numeric", month: "short", year: "numeric" }) : "—";

const totalOrden = (o: Orden) => o.orden_items.reduce((s, i) => s + Number(i.kg) * Number(i.costo_kg), 0);

export default function PaginaProveedores() {
  const [pestana, setPestana] = useState<"proveedores" | "ordenes">("proveedores");
  const [proveedores, setProveedores] = useState<Proveedor[] | null>(null);
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Alta de proveedor
  const [prov, setProv] = useState(PROV_VACIO);
  const [abiertoProv, setAbiertoProv] = useState(false);

  // Alta de orden
  const [abiertaOrden, setAbiertaOrden] = useState(false);
  const [provElegido, setProvElegido] = useState<number | null>(null);
  const [items, setItems] = useState([{ ...ITEM_VACIO }]);
  const [notasOrden, setNotasOrden] = useState("");
  const [lotes, setLotes] = useState<string[]>([]);

  // El código de cada lote se arma solo: origen, año y el número que sigue (también entre estas líneas).
  const region = proveedores?.find((p) => p.id === provElegido)?.region ?? "";
  const codigos = items.reduce<string[]>((ya, i) => {
    const vacia = !i.nombre.trim() && !i.origen.trim();
    return [...ya, vacia ? "" : codigoLote([i.origen, i.nombre, region], [...lotes, ...ordenes.flatMap((o) => o.orden_items.map((x) => x.codigo)), ...ya], new Date().getFullYear())];
  }, []);

  const faltaMigracion = (m: string) => /does not exist|schema cache/i.test(m);

  const cargar = useCallback(async () => {
    const [p, o, l] = await Promise.all([
      supabase.from("proveedores").select("*").order("nombre"),
      supabase
        .from("ordenes_compra")
        .select("*, proveedores(nombre), orden_items(*)")
        .order("creado_en", { ascending: false })
        .limit(100),
      supabase.from("cafe_verde").select("codigo"),
    ]);
    setLotes(((l.data as { codigo: string }[] | null) ?? []).map((x) => x.codigo));
    if (p.error) {
      setError(
        faltaMigracion(p.error.message)
          ? "Faltan las tablas de proveedores: corre la migración 011 en Supabase."
          : mensajeDeError(p.error),
      );
      setProveedores([]);
      return;
    }
    setProveedores((p.data as Proveedor[]) ?? []);
    setOrdenes(((o.data as unknown as Orden[]) ?? []).map((x) => ({ ...x, orden_items: x.orden_items ?? [] })));
  }, []);

  useEffect(() => {
    const t = window.setTimeout(cargar, 0);
    return () => window.clearTimeout(t);
  }, [cargar]);

  const guardarProveedor = async () => {
    if (!prov.nombre.trim()) return setError("El proveedor necesita un nombre.");
    setGuardando(true);
    setError("");
    const { error: e } = await supabase.from("proveedores").insert({
      nombre: prov.nombre.trim(),
      contacto: prov.contacto.trim() || null,
      telefono: prov.telefono.trim() || null,
      correo: prov.correo.trim() || null,
      region: prov.region.trim() || null,
      notas: prov.notas.trim() || null,
    });
    setGuardando(false);
    if (e) return setError(mensajeDeError(e));
    setProv(PROV_VACIO);
    setAbiertoProv(false);
    setAviso(`Proveedor ${prov.nombre.trim()} agregado.`);
    cargar();
  };

  const cambiarActivo = async (p: Proveedor) => {
    const { error: e } = await supabase.from("proveedores").update({ activo: !p.activo }).eq("id", p.id);
    if (e) return setError(mensajeDeError(e));
    cargar();
  };

  const guardarOrden = async () => {
    if (!provElegido) return setError("Elige a qué proveedor le compras.");
    const validos = items
      .map((i, k) => ({ ...i, codigo: codigos[k] }))
      .filter((i) => i.codigo && i.nombre.trim() && Number(i.kg) > 0 && Number(i.costo_kg) >= 0);
    if (!validos.length) return setError("Carga al menos un lote con nombre, origen, kilos y costo.");
    if (validos.length < items.filter((i) => i.nombre.trim() || i.origen.trim() || i.kg || i.costo_kg).length) return setError("Hay un lote a medias: completa su nombre, origen, kilos y costo, o quítalo.");

    setGuardando(true);
    setError("");
    // El código se arma con el año y un correlativo del año en curso.
    const anio = new Date().getFullYear();
    const n = ordenes.filter((o) => o.codigo.startsWith(`OC-${anio}`)).length + 1;
    const codigo = `OC-${anio}-${String(n).padStart(3, "0")}`;

    const { data, error: e } = await supabase
      .from("ordenes_compra")
      .insert({ codigo, proveedor_id: provElegido, estado: "enviada", notas: notasOrden.trim() || null })
      .select("id")
      .single();
    if (e || !data) {
      setGuardando(false);
      return setError(mensajeDeError(e ?? new Error("No se pudo crear la orden")));
    }

    const { error: e2 } = await supabase.from("orden_items").insert(
      validos.map((i) => ({
        orden_id: (data as { id: number }).id,
        codigo: i.codigo,
        nombre: i.nombre.trim(),
        origen: i.origen.trim() || null,
        kg: Number(i.kg),
        costo_kg: Number(i.costo_kg),
      })),
    );
    setGuardando(false);
    if (e2) return setError(mensajeDeError(e2));

    setAbiertaOrden(false);
    setProvElegido(null);
    setItems([{ ...ITEM_VACIO }]);
    setNotasOrden("");
    setAviso(`Orden ${codigo} creada.`);
    setPestana("ordenes");
    cargar();
  };

  const recibir = async (o: Orden) => {
    if (!window.confirm(`¿Recibir la orden ${o.codigo}? Los lotes entran al stock de bodega.`)) return;
    setGuardando(true);
    setError("");
    const { error: e } = await supabase.rpc("recibir_orden_compra", { p_orden: o.id });
    setGuardando(false);
    if (e) return setError(mensajeDeError(e));
    setAviso(`Orden ${o.codigo} recibida. El café verde ya está en Bodega.`);
    cargar();
  };

  const cancelarOrden = async (o: Orden) => {
    if (!window.confirm(`¿Cancelar la orden ${o.codigo}?`)) return;
    const { error: e } = await supabase
      .from("ordenes_compra")
      .update({ estado: "cancelada", cancelada_en: new Date().toISOString() })
      .eq("id", o.id);
    if (e) return setError(mensajeDeError(e));
    cargar();
  };

  const campo = (etiqueta: string, valor: string, alCambiar: (v: string) => void, ayuda = "", tipo = "text") => (
    <div className="carrito__campo">
      <label htmlFor={`p-${etiqueta}`}>{etiqueta}</label>
      <input id={`p-${etiqueta}`} type={tipo} value={valor} placeholder={ayuda} onChange={(e) => alCambiar(e.target.value)} disabled={guardando} />
    </div>
  );

  const activos = (proveedores ?? []).filter((p) => p.activo);

  return (
    <div className="equipo__pagina">
      <div className="equipo__cabeza">
        <div>
          <p className="eyebrow">Compras</p>
          <h1>Proveedores</h1>
        </div>
        <div className="equipo__acciones">
          {pestana === "proveedores" ? (
            <button type="button" className="btn btn--primary" onClick={() => { setAbiertoProv((x) => !x); setError(""); }}>
              {abiertoProv ? "Cerrar" : "Nuevo proveedor"}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary"
              disabled={!activos.length}
              title={!activos.length ? "Primero carga un proveedor" : undefined}
              onClick={() => { setAbiertaOrden((x) => !x); setError(""); }}
            >
              {abiertaOrden ? "Cerrar" : "Nueva orden de compra"}
            </button>
          )}
        </div>
      </div>

      <div className="pestanas" role="tablist" aria-label="Secciones">
        {(["proveedores", "ordenes"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={pestana === t} className={pestana === t ? "is-on" : ""} onClick={() => setPestana(t)}>
            {t === "proveedores" ? "Proveedores" : "Órdenes de compra"}
          </button>
        ))}
      </div>

      {error && <p className="carrito__error" role="alert">{error}</p>}
      {aviso && <p className="equipo__aviso" role="status">{aviso}</p>}

      {pestana === "proveedores" ? (
        <>
          {abiertoProv && (
            <section className="panel admin-form">
              <h2>Nuevo proveedor</h2>
              <div className="admin-form__grid">
                {campo("Nombre", prov.nombre, (v) => setProv({ ...prov, nombre: v }), "Finca Villa Serrano")}
                {campo("Persona de contacto", prov.contacto, (v) => setProv({ ...prov, contacto: v }), "Don Mario Céspedes")}
                {campo("Teléfono", prov.telefono, (v) => setProv({ ...prov, telefono: v }), "71234567", "tel")}
                {campo("Correo", prov.correo, (v) => setProv({ ...prov, correo: v }), "finca@correo.com", "email")}
                {campo("Región", prov.region, (v) => setProv({ ...prov, region: v }), "Villa Serrano, Chuquisaca")}
                {campo("Notas", prov.notas, (v) => setProv({ ...prov, notas: v }), "Cosecha de junio a agosto")}
              </div>
              <div className="equipo__fila">
                <button type="button" className="btn btn--primary" disabled={guardando} onClick={guardarProveedor}>
                  {guardando ? "Guardando…" : "Guardar proveedor"}
                </button>
                <button type="button" className="btn btn--secondary" onClick={() => setAbiertoProv(false)}>Cancelar</button>
              </div>
            </section>
          )}

          {proveedores === null ? (
            <p className="caja__vacia" aria-busy="true">Cargando proveedores…</p>
          ) : proveedores.length === 0 ? (
            <p className="caja__vacia">Todavía no hay proveedores. Carga el primero para poder registrar compras.</p>
          ) : (
            <div className="tabla-marco">
              <table className="tabla">
                <thead>
                  <tr>
                    <th scope="col">Proveedor</th>
                    <th scope="col">Contacto</th>
                    <th scope="col">Región</th>
                    <th scope="col">Estado</th>
                    <th scope="col" />
                  </tr>
                </thead>
                <tbody>
                  {proveedores.map((p) => (
                    <tr key={p.id}>
                      <td>
                        {p.nombre}
                        {p.notas && <small>{p.notas}</small>}
                      </td>
                      <td>
                        {p.contacto ?? "—"}
                        {p.telefono && <small>{p.telefono}</small>}
                        {p.correo && <small>{p.correo}</small>}
                      </td>
                      <td>{p.region ?? "—"}</td>
                      <td>
                        <span className={`estado ${p.activo ? "" : "estado--pausada"}`}>{p.activo ? "Activo" : "Dado de baja"}</span>
                      </td>
                      <td className="num">
                        <button type="button" className="link" onClick={() => cambiarActivo(p)}>
                          {p.activo ? "Dar de baja" : "Reactivar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          {abiertaOrden && (
            <section className="panel admin-form admin-form--orden">
              <h2>Nueva orden de compra</h2>

              <div className="carrito__campo">
                <label htmlFor="orden-prov">Proveedor</label>
                <select id="orden-prov" className="tueste-form__select" value={provElegido ?? ""} onChange={(e) => setProvElegido(Number(e.target.value) || null)} disabled={guardando}>
                  <option value="">Elige un proveedor</option>
                  {activos.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}{p.region ? ` · ${p.region}` : ""}</option>
                  ))}
                </select>
              </div>

              <h3 className="admin-form__sub">Lotes que se compran</h3>
              {items.map((it, i) => (
                <div key={i} className="orden-linea">
                  <div className="carrito__campo">
                    <span className="lote-auto__et">Código (automático)</span>
                    <output className="lote-auto">{codigos[i] || "Con el origen"}</output>
                  </div>
                  <div className="carrito__campo">
                    <label htmlFor={`i-nom-${i}`}>Nombre</label>
                    <input id={`i-nom-${i}`} value={it.nombre} placeholder="Villa Serrano Natural"
                      onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))} disabled={guardando} />
                  </div>
                  <div className="carrito__campo">
                    <label htmlFor={`i-ori-${i}`}>Origen</label>
                    <input id={`i-ori-${i}`} value={it.origen} placeholder="Chuquisaca"
                      onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, origen: e.target.value } : x)))} disabled={guardando} />
                  </div>
                  <div className="carrito__campo">
                    <label htmlFor={`i-kg-${i}`}>Kilos</label>
                    <input id={`i-kg-${i}`} type="number" inputMode="decimal" value={it.kg} placeholder="60"
                      onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, kg: e.target.value } : x)))} disabled={guardando} />
                  </div>
                  <div className="carrito__campo">
                    <label htmlFor={`i-cos-${i}`}>Costo por kg</label>
                    <input id={`i-cos-${i}`} type="number" inputMode="decimal" value={it.costo_kg} placeholder="42"
                      onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, costo_kg: e.target.value } : x)))} disabled={guardando} />
                  </div>
                  {items.length > 1 && (
                    <button type="button" className="link orden-linea__quitar" onClick={() => setItems(items.filter((_, j) => j !== i))}>
                      Quitar
                    </button>
                  )}
                </div>
              ))}

              <button type="button" className="btn btn--secondary orden-agregar" onClick={() => setItems([...items, { ...ITEM_VACIO }])}>
                + Agregar otro lote
              </button>

              <div className="carrito__campo">
                <label htmlFor="orden-notas">Notas</label>
                <input id="orden-notas" value={notasOrden} placeholder="Entrega en Sucre la próxima semana"
                  onChange={(e) => setNotasOrden(e.target.value)} disabled={guardando} />
              </div>

              <div className="caja__total">
                <span>Total de la orden</span>
                <strong>{formatBs(items.reduce((s, i) => s + (Number(i.kg) || 0) * (Number(i.costo_kg) || 0), 0))}</strong>
              </div>

              <div className="equipo__fila">
                <button type="button" className="btn btn--primary" disabled={guardando} onClick={guardarOrden}>
                  {guardando ? "Guardando…" : "Crear orden"}
                </button>
                <button type="button" className="btn btn--secondary" onClick={() => setAbiertaOrden(false)}>Cancelar</button>
              </div>
            </section>
          )}

          {ordenes.length === 0 ? (
            <p className="caja__vacia">Todavía no hay órdenes de compra.</p>
          ) : (
            <ul className="ordenes">
              {ordenes.map((o) => (
                <li key={o.id} className="orden">
                  <div className="orden__cabeza">
                    <div>
                      <strong>{o.codigo}</strong>
                      <small>{o.proveedores?.nombre ?? "Proveedor"} · {fecha(o.creado_en)}</small>
                    </div>
                    <span className={`estado ${CLASE_ORDEN[o.estado]}`}>{ESTADO_ORDEN[o.estado]}</span>
                  </div>

                  <div className="tabla-marco tabla-marco--plano">
                    <table className="tabla">
                      <thead>
                        <tr>
                          <th scope="col">Lote</th>
                          <th scope="col" className="num">Kilos</th>
                          <th scope="col" className="num">Costo/kg</th>
                          <th scope="col" className="num">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {o.orden_items.map((i) => (
                          <tr key={i.id}>
                            <td>
                              {i.nombre}
                              <small>{i.codigo}{i.origen ? ` · ${i.origen}` : ""}</small>
                            </td>
                            <td className="num">{Number(i.kg)} kg</td>
                            <td className="num">{formatBs(Number(i.costo_kg))}</td>
                            <td className="num">{formatBs(Number(i.kg) * Number(i.costo_kg))}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={3}>Total</td>
                          <td className="num"><strong>{formatBs(totalOrden(o))}</strong></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {o.notas && <p className="caja__sub">{o.notas}</p>}

                  {o.estado === "recibida" ? (
                    <p className="caja__comprobante"><strong>Recibida el {fecha(o.recibida_en)}</strong> Los lotes ya están en Bodega.</p>
                  ) : o.estado === "cancelada" ? (
                    <p className="caja__sub">Orden cancelada.</p>
                  ) : (
                    <div className="equipo__fila">
                      <button type="button" className="btn btn--primary" disabled={guardando} onClick={() => recibir(o)}>
                        Recibir en bodega
                      </button>
                      <button type="button" className="btn btn--secondary" disabled={guardando} onClick={() => cancelarOrden(o)}>
                        Cancelar
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
