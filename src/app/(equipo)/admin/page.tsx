"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatBs } from "@/lib/utils";
import BotonesDocumento from "@/components/ui/BotonesDocumento";
import HojaDocumento from "@/components/ui/HojaDocumento";
import CobrosClub from "@/components/equipo/CobrosClub";
import type { HojaExcel } from "@/lib/excel";

/**
 * Panel general del administrador (RF-33 a RF-36): ventas reales por canal y período,
 * productos más vendidos, merma por lote de tueste y mensajes del formulario de contacto.
 *
 * Solo cuenta lo cobrado: un pedido por QR que todavía no se pagó no es una venta. Los envíos
 * pagados del Club entran en su propio canal.
 *
 * El reporte se descarga en Excel (totales, producto por producto en cada canal y venta por venta)
 * y en PDF con las mismas cifras reales del período. El
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
  { v: "totem", label: "Tótem de autoservicio" },
  { v: "club", label: "Club (suscripciones)" },
  { v: "subasta", label: "Subastas" },
];

type Pedido = {
  codigo: string;
  creado_en: string;
  canal: string;
  total: number;
  descuento: number;
  estado: string;
  pago_estado: string | null;
  metodo_pago: string | null;
  nombre: string | null;
  turno: number | null;
  pedido_items: { cantidad: number; precio: number; molienda: string | null; producto_id: string; productos: { nombre: string; categoria: string } | null }[];
};
/** Un envío del Club ya pagado. */
type CobroClub = {
  id: number;
  monto: number;
  periodo: string;
  /** El pedido que nació al pagarlo (migración 023); null en los cobros de antes. */
  pedido_id: number | null;
  verificado_en: string;
  cliente: { nombre: string } | null;
  suscripciones: { gramos: number; frecuencia: number; cafe: string } | null;
};
const SIN_COBRAR = ["pendiente", "por_verificar", "rechazado"];
const METODO: Record<string, string> = { qr: "QR", tarjeta: "Tarjeta", efectivo: "Efectivo" };
const ESTADO: Record<string, string> = { recibido: "Recibido", preparacion: "En preparación", en_camino: "En camino", entregado: "Entregado" };
const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", hour12: false });
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
  const [club, setClub] = useState<CobroClub[]>([]);
  const [tuestes, setTuestes] = useState<Tueste[]>([]);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [abierto, setAbierto] = useState<number | null>(null);

  const cargar = useCallback(async (p: Periodo) => {
    const desde = new Date(Date.now() - PERIODOS.find((x) => x.v === p)!.dias * 86_400_000).toISOString();
    const [{ data }, { data: cobros }] = await Promise.all([
      supabase
        .from("pedidos")
        .select("codigo, creado_en, canal, total, descuento, estado, pago_estado, metodo_pago, nombre, turno, pedido_items(cantidad, precio, molienda, producto_id, productos(nombre, categoria))")
        .gte("creado_en", desde)
        .neq("estado", "cancelado")
        .order("creado_en", { ascending: false }),
      supabase
        .from("cobros_club")
        .select("id, monto, periodo, pedido_id, verificado_en, cliente:perfiles!cobros_club_cliente_id_fkey(nombre), suscripciones(gramos, frecuencia, cafe)")
        .eq("estado", "aprobado")
        .gte("verificado_en", desde)
        .order("verificado_en", { ascending: false }),
    ]);
    setClub(((cobros as unknown as CobroClub[]) ?? []).map((x) => ({ ...x, monto: Number(x.monto) })));
    setPedidos(
      ((data as unknown as Pedido[]) ?? [])
        .filter((x) => !SIN_COBRAR.includes(x.pago_estado ?? ""))
        .map((x) => ({ ...x, total: Number(x.total), descuento: Number(x.descuento ?? 0) })),
    );
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

  // Cada venta (tienda, caja, tótem…) actualiza el panel sola, sin recargar.
  useEffect(() => {
    const canal = supabase
      .channel("panel-ventas")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => cargar(periodo))
      .on("postgres_changes", { event: "*", schema: "public", table: "cobros_club" }, () => cargar(periodo))
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [cargar, periodo]);

  const elegir = (p: Periodo) => {
    setPeriodo(p);
    setPedidos(null);
    cargar(p);
  };

  const lista = pedidos ?? [];
  const canales = CANALES.map((c) => {
    const del: { total: number }[] = c.v === "club" ? club.map((x) => ({ total: x.monto })) : lista.filter((p) => p.canal === c.v);
    return { ...c, monto: del.reduce((s, p) => s + p.total, 0), pedidos: del.length };
  });
  const ingresos = canales.reduce((s, c) => s + c.monto, 0);
  const n = canales.reduce((s, c) => s + c.pedidos, 0);
  const max = Math.max(1, ...canales.map((c) => c.monto));
  const bolsas = lista.flatMap((p) => p.pedido_items).filter((i) => i.productos && ["grano", "molido"].includes(i.productos.categoria)).reduce((s, i) => s + i.cantidad, 0);

  const kgClub = club.filter((c) => !c.pedido_id).reduce((s, c) => s + (c.suscripciones?.gramos ?? 0), 0) / 1000;

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
    { label: "Café vendido", valor: `${(bolsas / 4 + kgClub).toLocaleString("es-BO")} kg` },
  ];

  const nombreCanal = (v: string) => CANALES.find((c) => c.v === v)?.label ?? v;
  const clienteDe = (p: Pedido) => (p.turno != null ? `Turno #${String(p.turno).padStart(3, "0")}` : p.nombre ?? (p.canal === "caja" ? "Mostrador" : "—"));

  /** Cada producto en cada canal, para la hoja "Productos por canal". */
  const productosPorCanal = () => {
    const filas = new Map<string, { canal: string; nombre: string; unidades: number; monto: number }>();
    for (const p of lista)
      for (const i of p.pedido_items) {
        const clave = `${p.canal}|${i.producto_id}`;
        const f = filas.get(clave) ?? { canal: p.canal, nombre: i.productos?.nombre ?? i.producto_id, unidades: 0, monto: 0 };
        f.unidades += i.cantidad;
        f.monto += Number(i.precio) * i.cantidad;
        filas.set(clave, f);
      }
    const orden = CANALES.map((c) => c.v);
    return [...filas.values()]
      .sort((a, b) => orden.indexOf(a.canal) - orden.indexOf(b.canal) || b.monto - a.monto)
      .map((f) => ({ ...f, canal: nombreCanal(f.canal) }));
  };

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
      })).concat({ canal: "TOTAL", pedidos: n, monto: ingresos, ticket: n ? ingresos / n : 0, parte: ingresos ? 1 : 0 }),
    },
    {
      nombre: "Productos por canal",
      columnas: [
        { titulo: "Canal", clave: "canal" },
        { titulo: "Producto", clave: "nombre" },
        { titulo: "Unidades", clave: "unidades", formato: "entero" },
        { titulo: "Ventas", clave: "monto", formato: "moneda" },
      ],
      filas: productosPorCanal(),
    },
    {
      nombre: "Ventas una por una",
      columnas: [
        { titulo: "Fecha", clave: "fecha", formato: "fecha" },
        { titulo: "Hora", clave: "hora" },
        { titulo: "Código", clave: "codigo" },
        { titulo: "Canal", clave: "canal" },
        { titulo: "Cliente", clave: "cliente" },
        { titulo: "Pago", clave: "pago" },
        { titulo: "Estado", clave: "estado" },
        { titulo: "Subtotal", clave: "subtotal", formato: "moneda" },
        { titulo: "Descuento", clave: "descuento", formato: "moneda" },
        { titulo: "Total", clave: "total", formato: "moneda" },
      ],
      filas: lista.map((p) => ({
        fecha: new Date(p.creado_en),
        hora: hora(p.creado_en),
        codigo: p.codigo,
        canal: nombreCanal(p.canal),
        cliente: clienteDe(p),
        pago: METODO[p.metodo_pago ?? ""] ?? p.metodo_pago ?? "—",
        // En la caja el producto se entrega en el momento: su pedido no pasa por Logística.
        estado: p.canal === "caja" ? "Entregado" : ESTADO[p.estado] ?? p.estado,
        subtotal: p.total + p.descuento,
        descuento: p.descuento,
        total: p.total,
      })),
    },
    {
      nombre: "Detalle por producto",
      columnas: [
        { titulo: "Fecha", clave: "fecha", formato: "fecha" },
        { titulo: "Hora", clave: "hora" },
        { titulo: "Código", clave: "codigo" },
        { titulo: "Canal", clave: "canal" },
        { titulo: "Producto", clave: "producto" },
        { titulo: "Opciones", clave: "opciones" },
        { titulo: "Cantidad", clave: "cantidad", formato: "entero" },
        { titulo: "Precio", clave: "precio", formato: "moneda" },
        { titulo: "Subtotal", clave: "subtotal", formato: "moneda" },
      ],
      filas: lista.flatMap((p) =>
        p.pedido_items.map((i) => ({
          fecha: new Date(p.creado_en),
          hora: hora(p.creado_en),
          codigo: p.codigo,
          canal: nombreCanal(p.canal),
          producto: i.productos?.nombre ?? i.producto_id,
          opciones: i.molienda && i.molienda !== "Única" ? i.molienda : "",
          cantidad: i.cantidad,
          precio: Number(i.precio),
          subtotal: Number(i.precio) * i.cantidad,
        })),
      ),
    },
    {
      nombre: "Envíos del Club",
      columnas: [
        { titulo: "Pagado el", clave: "pagado", formato: "fecha" },
        { titulo: "Cliente", clave: "cliente" },
        { titulo: "Envío", clave: "envio", formato: "fecha" },
        { titulo: "Cantidad (g)", clave: "gramos", formato: "entero" },
        { titulo: "Cada (días)", clave: "dias", formato: "entero" },
        { titulo: "Monto", clave: "monto", formato: "moneda" },
      ],
      filas: club.map((c) => ({
        pagado: new Date(c.verificado_en),
        cliente: c.cliente?.nombre ?? "—",
        envio: new Date(c.periodo + "T12:00:00"),
        gramos: c.suscripciones?.gramos ?? null,
        dias: c.suscripciones?.frecuencia ?? null,
        monto: c.monto,
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

        {/* Solo para supervisar: los pagos del Club se confirman solos (migración 019). */}
        <section className="panel" aria-labelledby="cobros-club-titulo">
          <h2 id="cobros-club-titulo">Cobros del Club</h2>
          <CobrosClub />
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
