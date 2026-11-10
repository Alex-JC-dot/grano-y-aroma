"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatBs } from "@/lib/utils";
import BotonesDocumento from "@/components/ui/BotonesDocumento";
import HojaDocumento from "@/components/ui/HojaDocumento";
import type { HojaExcel } from "@/lib/excel";

/**
 * Panel general del administrador (RF-33 a RF-36): ventas reales por canal y período,
 * productos más vendidos, merma por lote de tueste y mensajes del formulario de contacto.
 *
 * El reporte se descarga en Excel y en PDF con las mismas cifras reales del período. El
 * bloque imprimible va al final, marcado con solo-papel: no se ve en pantalla, pero el
 * diálogo de impresión lo toma y produce el PDF con membrete.
 */

type Periodo = "semana" | "mes" | "anio";
const PERIODOS: { v: Periodo; label: string; dias: number }[] = [
  { v: "semana", label: "Semana", dias: 7 },
  { v: "mes", label: "Mes", dias: 30 },
  { v: "anio", label: "Año", dias: 365 },
];
const CANALES: { v: string; label: string }[] = [
  { v: "web", label: "Tienda en línea" },
  { v: "caja", label: "Caja de la cafetería" },
  { v: "club", label: "Club (suscripciones)" },
  { v: "subasta", label: "Subastas" },
];

type Pedido = {
  canal: string;
  total: number;
  estado: string;
  pedido_items: { cantidad: number; precio: number; producto_id: string; productos: { nombre: string; categoria: string } | null }[];
};
type Tueste = { codigo: string; kg_verde: number; kg_tostado: number; puntaje: number | null };
type Mensaje = { id: number; nombre: string; email: string; telefono: string | null; motivo: string; mensaje: string; leido: boolean; creado_en: string };

const ATAJOS = [
  { href: "/admin/productos", label: "Productos y stock" },
  { href: "/admin/subastas", label: "Publicar subastas" },
  { href: "/admin/usuarios", label: "Usuarios y roles" },
  { href: "/logistica", label: "Ver pedidos" },
];

export default function PaginaPanel() {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [tuestes, setTuestes] = useState<Tueste[]>([]);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [abierto, setAbierto] = useState<number | null>(null);

  const cargar = useCallback(async (p: Periodo) => {
    const desde = new Date(Date.now() - PERIODOS.find((x) => x.v === p)!.dias * 86_400_000).toISOString();
    const { data } = await supabase
      .from("pedidos")
      .select("canal, total, estado, pedido_items(cantidad, precio, producto_id, productos(nombre, categoria))")
      .gte("creado_en", desde)
      .neq("estado", "cancelado");
    setPedidos(((data as unknown as Pedido[]) ?? []).map((x) => ({ ...x, total: Number(x.total) })));
  }, []);

  useEffect(() => {
    const t = window.setTimeout(async () => {
      cargar("mes");
      const [tu, me] = await Promise.all([
        supabase.from("tuestes").select("codigo, kg_verde, kg_tostado, puntaje").order("creado_en", { ascending: false }).limit(8),
        supabase.from("mensajes").select("*").order("creado_en", { ascending: false }).limit(30),
      ]);
      setTuestes(((tu.data as Tueste[]) ?? []).map((x) => ({ ...x, kg_verde: Number(x.kg_verde), kg_tostado: Number(x.kg_tostado) })));
      setMensajes((me.data as Mensaje[]) ?? []);
    }, 0);
    return () => window.clearTimeout(t);
  }, [cargar]);

  const elegir = (p: Periodo) => {
    setPeriodo(p);
    setPedidos(null);
    cargar(p);
  };

  const lista = pedidos ?? [];
  const canales = CANALES.map((c) => {
    const del = lista.filter((p) => p.canal === c.v);
    return { ...c, monto: del.reduce((s, p) => s + p.total, 0), pedidos: del.length };
  });
  const ingresos = canales.reduce((s, c) => s + c.monto, 0);
  const n = lista.length;
  const max = Math.max(1, ...canales.map((c) => c.monto));
  const bolsas = lista.flatMap((p) => p.pedido_items).filter((i) => i.productos && ["grano", "molido"].includes(i.productos.categoria)).reduce((s, i) => s + i.cantidad, 0);

  const ventasPorProducto = new Map<string, { nombre: string; unidades: number; monto: number }>();
  for (const i of lista.flatMap((p) => p.pedido_items)) {
    const v = ventasPorProducto.get(i.producto_id) ?? { nombre: i.productos?.nombre ?? i.producto_id, unidades: 0, monto: 0 };
    v.unidades += i.cantidad;
    v.monto += Number(i.precio) * i.cantidad;
    ventasPorProducto.set(i.producto_id, v);
  }
  const top = [...ventasPorProducto.values()].sort((a, b) => b.monto - a.monto).slice(0, 6);

  const datos = [
    { label: "Ingresos", valor: formatBs(ingresos) },
    { label: "Pedidos", valor: n.toLocaleString("es-BO") },
    { label: "Ticket promedio", valor: n ? formatBs(ingresos / n) : "—" },
    { label: "Café vendido", valor: `${(bolsas / 4).toLocaleString("es-BO")} kg` },
  ];

  /** Hojas del Excel; solo se arman al pulsar "Descargar Excel". Los importes van como números. */
  const hojasExcel = (): HojaExcel[] => [
    {
      nombre: "Ventas por canal",
      columnas: [
        { titulo: "Canal", clave: "canal" },
        { titulo: "Pedidos", clave: "pedidos", formato: "entero" },
        { titulo: "Monto", clave: "monto", formato: "moneda" },
        { titulo: "Ticket promedio", clave: "ticket", formato: "moneda" },
        { titulo: "Participación", clave: "parte", formato: "porcentaje" },
      ],
      filas: canales.map((c) => ({
        canal: c.label,
        pedidos: c.pedidos,
        monto: c.monto,
        ticket: c.pedidos ? c.monto / c.pedidos : 0,
        parte: ingresos ? c.monto / ingresos : 0,
      })),
    },
    {
      nombre: "Lo más vendido",
      columnas: [
        { titulo: "Producto", clave: "nombre" },
        { titulo: "Unidades", clave: "unidades", formato: "entero" },
        { titulo: "Ventas", clave: "monto", formato: "moneda" },
      ],
      filas: [...ventasPorProducto.values()].sort((a, b) => b.monto - a.monto),
    },
    {
      nombre: "Merma por lote",
      columnas: [
        { titulo: "Lote", clave: "lote" },
        { titulo: "Verde (kg)", clave: "verde", formato: "numero" },
        { titulo: "Tostado (kg)", clave: "tostado", formato: "numero" },
        { titulo: "Merma", clave: "merma", formato: "porcentaje" },
        { titulo: "Puntaje", clave: "puntaje", formato: "numero" },
      ],
      filas: tuestes.map((l) => ({
        lote: l.codigo,
        verde: l.kg_verde,
        tostado: l.kg_tostado,
        merma: l.kg_verde ? 1 - l.kg_tostado / l.kg_verde : 0,
        puntaje: l.puntaje == null ? null : Number(l.puntaje),
      })),
    },
  ];
  const elPeriodo = PERIODOS.find((x) => x.v === periodo)!;

  const marcarLeido = async (m: Mensaje) => {
    setAbierto(abierto === m.id ? null : m.id);
    if (m.leido) return;
    setMensajes((ms) => ms.map((x) => (x.id === m.id ? { ...x, leido: true } : x)));
    await supabase.from("mensajes").update({ leido: true }).eq("id", m.id);
  };
  const sinLeer = mensajes.filter((m) => !m.leido).length;

  return (
    <div className="equipo__pagina">
      <div className="equipo__cabeza">
        <div>
          <p className="eyebrow">Administración</p>
          <h1>Panel general</h1>
        </div>
        <div className="equipo__acciones">
          <BotonesDocumento
            concepto={`reporte-${periodo}`}
            tituloPdf={`Grano y Aroma - Reporte de ventas (${elPeriodo.label.toLowerCase()})`}
            hojas={hojasExcel}
          />
          <div className="segmentado" role="radiogroup" aria-label="Período">
            {PERIODOS.map((p) => (
              <button key={p.v} type="button" role="radio" aria-checked={periodo === p.v} className={periodo === p.v ? "is-on" : ""} onClick={() => elegir(p.v)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="tarjetas-dato tarjetas-dato--4" aria-busy={pedidos === null}>
        {datos.map((d) => (
          <div key={d.label} className="dato">
            <span className="dato__label">{d.label}</span>
            <strong className="dato__valor">{pedidos === null ? "…" : d.valor}</strong>
          </div>
        ))}
      </div>

      <div className="equipo__dos">
        <section className="panel" aria-labelledby="canales-titulo">
          <h2 id="canales-titulo">Ventas por canal</h2>
          <ul className="barras">
            {canales.map((c) => (
              <li key={c.v}>
                <div className="barras__fila">
                  <span>{c.label}</span>
                  <span>
                    <small>{c.pedidos === 1 ? "1 pedido" : `${c.pedidos} pedidos`}</small> {formatBs(c.monto)}
                  </span>
                </div>
                <div className="barras__pista" aria-hidden="true">
                  <span style={{ width: `${(c.monto / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <div className="caja__total">
            <span>Total</span>
            <strong>{formatBs(ingresos)}</strong>
          </div>
        </section>

        <section className="panel" aria-labelledby="top-titulo">
          <h2 id="top-titulo">Lo más vendido</h2>
          {top.length === 0 ? (
            <p className="caja__vacia">Todavía no hay ventas en este período.</p>
          ) : (
            <div className="tabla-marco tabla-marco--plano">
              <table className="tabla">
                <thead>
                  <tr>
                    <th scope="col">Producto</th>
                    <th scope="col" className="num">Unidades</th>
                    <th scope="col" className="num">Ventas</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((t) => (
                    <tr key={t.nombre}>
                      <td>{t.nombre}</td>
                      <td className="num">{t.unidades}</td>
                      <td className="num"><strong>{formatBs(t.monto)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <div className="equipo__dos">
        <section className="panel" aria-labelledby="lotes-titulo">
          <h2 id="lotes-titulo">Merma por lote de tueste</h2>
          {tuestes.length === 0 ? (
            <p className="caja__vacia">Sin tuestes registrados.</p>
          ) : (
            <div className="tabla-marco tabla-marco--plano">
              <table className="tabla">
                <thead>
                  <tr>
                    <th scope="col">Lote</th>
                    <th scope="col" className="num">Verde → tostado</th>
                    <th scope="col" className="num">Merma</th>
                  </tr>
                </thead>
                <tbody>
                  {tuestes.map((l) => (
                    <tr key={l.codigo}>
                      <td>
                        {l.codigo}
                        {l.puntaje != null && <small>{Number(l.puntaje).toLocaleString("es-BO", { minimumFractionDigits: 1 })} puntos</small>}
                      </td>
                      <td className="num">{l.kg_verde} → {l.kg_tostado} kg</td>
                      <td className="num"><strong>{Math.round((1 - l.kg_tostado / l.kg_verde) * 100)} %</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel" aria-labelledby="mensajes-titulo">
          <h2 id="mensajes-titulo">Mensajes {sinLeer > 0 && <span className="estado estado--recibido">{sinLeer} sin leer</span>}</h2>
          {mensajes.length === 0 ? (
            <p className="caja__vacia">Nadie escribió todavía desde el formulario de contacto.</p>
          ) : (
            <ul className="mensajes">
              {mensajes.map((m) => (
                <li key={m.id} className={m.leido ? "" : "is-nuevo"}>
                  <button type="button" className="mensajes__cabeza" aria-expanded={abierto === m.id} onClick={() => marcarLeido(m)}>
                    <strong>{m.nombre}</strong>
                    <span>{m.motivo} · {new Date(m.creado_en).toLocaleDateString("es-BO", { day: "numeric", month: "short" })}</span>
                  </button>
                  {abierto === m.id && (
                    <div className="mensajes__cuerpo">
                      <p>{m.mensaje}</p>
                      <p className="caja__sub">
                        <a className="link" href={`mailto:${m.email}`}>{m.email}</a>
                        {m.telefono && <> · <a className="link" href={`https://wa.me/${m.telefono.replace(/\D/g, "")}`}>{m.telefono}</a></>}
                      </p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <nav className="atajos no-imprimir" aria-label="Atajos">
        {ATAJOS.map((a) => (
          <Link key={a.href} href={a.href} className="atajo">
            {a.label} <span aria-hidden="true">→</span>
          </Link>
        ))}
      </nav>

      {/* Versión en papel del reporte. Invisible en pantalla, es lo único que sale al imprimir. */}
      <HojaDocumento
        className="solo-papel imprimible"
        titulo="Reporte de ventas y producción"
        subtitulo={`Período: ${elPeriodo.label.toLowerCase()} (últimos ${elPeriodo.dias} días)`}
        numero={`RV-${periodo.toUpperCase()}`}
        etiquetaNumero="Reporte"
      >
        <section className="doc__bloque">
          <h3>Resumen</h3>
          <dl className="doc__datos">
            {datos.map((d) => (
              <div key={d.label}>
                <dt>{d.label}</dt>
                <dd>{d.valor}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="doc__bloque">
          <h3>Ventas por canal</h3>
          <table className="doc__tabla">
            <thead>
              <tr>
                <th scope="col">Canal</th>
                <th scope="col" className="num">Pedidos</th>
                <th scope="col" className="num">Monto</th>
                <th scope="col" className="num">Participación</th>
              </tr>
            </thead>
            <tbody>
              {canales.map((c) => (
                <tr key={c.v}>
                  <td>{c.label}</td>
                  <td className="num">{c.pedidos.toLocaleString("es-BO")}</td>
                  <td className="num">{formatBs(c.monto)}</td>
                  <td className="num">{ingresos ? Math.round((c.monto / ingresos) * 100) : 0} %</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="doc__gran-total">
                <td>Total</td>
                <td className="num">{n.toLocaleString("es-BO")}</td>
                <td className="num">{formatBs(ingresos)}</td>
                <td className="num">100 %</td>
              </tr>
            </tfoot>
          </table>
        </section>

        {top.length > 0 && (
          <section className="doc__bloque">
            <h3>Lo más vendido</h3>
            <table className="doc__tabla">
              <thead>
                <tr>
                  <th scope="col">Producto</th>
                  <th scope="col" className="num">Unidades</th>
                  <th scope="col" className="num">Ventas</th>
                </tr>
              </thead>
              <tbody>
                {top.map((t) => (
                  <tr key={t.nombre}>
                    <td>{t.nombre}</td>
                    <td className="num">{t.unidades}</td>
                    <td className="num">{formatBs(t.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {tuestes.length > 0 && (
          <section className="doc__bloque">
            <h3>Merma por lote de tueste</h3>
            <table className="doc__tabla">
              <thead>
                <tr>
                  <th scope="col">Lote</th>
                  <th scope="col" className="num">Verde → tostado</th>
                  <th scope="col" className="num">Merma</th>
                </tr>
              </thead>
              <tbody>
                {tuestes.map((l) => (
                  <tr key={l.codigo}>
                    <td>{l.codigo}</td>
                    <td className="num">{l.kg_verde} → {l.kg_tostado} kg</td>
                    <td className="num">{Math.round((1 - l.kg_tostado / l.kg_verde) * 100)} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </HojaDocumento>
    </div>
  );
}
