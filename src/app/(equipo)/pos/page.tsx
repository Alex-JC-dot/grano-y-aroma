"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mensajeDeError, supabase } from "@/lib/supabase";
import { formatBs } from "@/lib/utils";
import type { FilaProducto } from "@/store/catalogoStore";
import HojaDocumento from "@/components/ui/HojaDocumento";
import BotonesDocumento from "@/components/ui/BotonesDocumento";
import { fechaISO, imprimirDocumento } from "@/lib/documento";
import type { HojaExcel } from "@/lib/excel";

/**
 * Caja de la cafetería (Punto de Venta, RF-17 a RF-21): la barra y los productos de la tienda
 * salen de Supabase; cada cobro pasa por confirmar_pedido() con canal "caja", que descuenta el
 * stock compartido con la tienda en línea. El cierre de caja suma las ventas del día por método.
 *
 * La caja emite dos documentos: el comprobante de venta (RF-18) y el cierre de caja (RF-19),
 * en PDF y el cierre también en Excel. Solo uno puede estar marcado como imprimible a la vez:
 * si los dos lo estuvieran, saldrían juntos en la misma hoja. `impresion` decide cuál, y
 * lleva un contador para que pedir dos veces seguidas el mismo documento vuelva a imprimir.
 */

type Item = Pick<FilaProducto, "id" | "nombre" | "categoria" | "precio" | "stock" | "stock_minimo" | "grupo">;
type Linea = Item & { qty: number };
type Metodo = "efectivo" | "qr" | "tarjeta";
const METODOS: { v: Metodo; label: string }[] = [
  { v: "efectivo", label: "Efectivo" },
  { v: "qr", label: "QR" },
  { v: "tarjeta", label: "Tarjeta" },
];
const ORDEN_GRUPOS = ["Bebidas calientes", "Métodos", "Bebidas frías", "Pastelería", "Otros", "Tienda"];
const grupoDe = (i: Item) => (i.categoria === "bebida" ? i.grupo ?? "Otros" : "Tienda");

type Turno = Record<Metodo, { monto: number; ventas: number }>;
const TURNO_VACIO: Turno = { efectivo: { monto: 0, ventas: 0 }, qr: { monto: 0, ventas: 0 }, tarjeta: { monto: 0, ventas: 0 } };

/** Lo que queda de una venta cobrada: la orden se vacía enseguida. */
type Venta = {
  numero: string;
  hora: string;
  lineas: { nombre: string; categoria: string; qty: number; precio: number }[];
  total: number;
  metodo: string;
};

export default function PaginaCaja() {
  const [items, setItems] = useState<Item[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cat, setCat] = useState("Todos");
  const [orden, setOrden] = useState<Linea[]>([]);
  const [metodo, setMetodo] = useState<Metodo>("efectivo");
  const [turno, setTurno] = useState<Turno>(TURNO_VACIO);
  const [venta, setVenta] = useState<Venta | null>(null);
  const [impresion, setImpresion] = useState<{ tipo: "venta" | "cierre"; titulo: string; n: number } | null>(null);
  const [error, setError] = useState("");
  const [cobrando, setCobrando] = useState(false);
  const cierreRef = useRef<HTMLDialogElement>(null);

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from("productos")
      .select("id, nombre, categoria, precio, stock, stock_minimo, grupo")
      .eq("activo", true)
      .order("orden");
    setItems(((data as Item[]) ?? []).map((i) => ({ ...i, precio: Number(i.precio) })));
    setCargando(false);
  }, []);

  const cargarTurno = useCallback(async () => {
    const desde = new Date();
    desde.setHours(0, 0, 0, 0);
    const { data } = await supabase.from("pedidos").select("metodo_pago, total").eq("canal", "caja").gte("creado_en", desde.toISOString());
    const t: Turno = { efectivo: { monto: 0, ventas: 0 }, qr: { monto: 0, ventas: 0 }, tarjeta: { monto: 0, ventas: 0 } };
    for (const p of (data as { metodo_pago: Metodo; total: number }[]) ?? []) {
      if (!t[p.metodo_pago]) continue;
      t[p.metodo_pago].monto += Number(p.total);
      t[p.metodo_pago].ventas += 1;
    }
    setTurno(t);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      cargar();
      cargarTurno();
    }, 0);
    return () => window.clearTimeout(t);
  }, [cargar, cargarTurno]);

  const grupos = ["Todos", ...ORDEN_GRUPOS.filter((g) => items.some((i) => grupoDe(i) === g))];
  const visibles = items.filter((i) => cat === "Todos" || grupoDe(i) === cat);
  const total = orden.reduce((s, i) => s + i.precio * i.qty, 0);
  const unidades = orden.reduce((s, i) => s + i.qty, 0);

  // Imprime cuando el documento ya está marcado en el DOM, no antes. Depende solo del pedido
  // de impresión: si dependiera de la venta, cada venta nueva abriría otra vez el diálogo.
  useEffect(() => {
    if (impresion) imprimirDocumento(impresion.titulo);
  }, [impresion]);

  const pedirImpresion = (tipo: "venta" | "cierre") =>
    setImpresion((previa) => ({
      tipo,
      titulo: tipo === "venta" ? `Comprobante ${venta?.numero ?? ""} - Grano y Aroma` : "Cierre de caja - Grano y Aroma",
      n: (previa?.n ?? 0) + 1,
    }));

  const agregar = (item: Item) => {
    setVenta(null);
    setError("");
    setOrden((o) => {
      const ya = o.find((x) => x.id === item.id)?.qty ?? 0;
      if (ya >= item.stock) return o;
      return ya ? o.map((x) => (x.id === item.id ? { ...x, qty: x.qty + 1 } : x)) : [...o, { ...item, qty: 1 }];
    });
  };
  const cambiar = (id: string, d: number) =>
    setOrden((o) => o.map((x) => (x.id === id ? { ...x, qty: Math.min(x.stock, x.qty + d) } : x)).filter((x) => x.qty > 0));

  const cobrar = async () => {
    setCobrando(true);
    setError("");
    const { data, error } = await supabase.rpc("confirmar_pedido", {
      items: orden.map((l) => ({ producto_id: l.id, cantidad: l.qty, molienda: "Única" })),
      p_canal: "caja",
      p_metodo: metodo,
    });
    setCobrando(false);
    if (error) return setError(mensajeDeError(error));
    // El detalle se copia de la orden antes de vaciarla; si no, el comprobante saldría vacío.
    setVenta({
      numero: data.codigo,
      hora: new Date().toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", hour12: false }),
      lineas: orden.map((l) => ({ nombre: l.nombre, categoria: grupoDe(l), qty: l.qty, precio: l.precio })),
      total: Number(data.total),
      metodo: METODOS.find((m) => m.v === metodo)!.label,
    });
    setOrden([]);
    cargar();
    cargarTurno();
  };

  const totalTurno = Object.values(turno).reduce((s, x) => s + x.monto, 0);
  const ventasTurno = Object.values(turno).reduce((s, x) => s + x.ventas, 0);

  /** Hoja de Excel del cierre de caja (RF-19). */
  const hojasCierre = (): HojaExcel[] => [
    {
      nombre: "Cierre de caja",
      columnas: [
        { titulo: "Método de pago", clave: "metodo" },
        { titulo: "Ventas", clave: "ventas", formato: "entero" },
        { titulo: "Monto", clave: "monto", formato: "moneda" },
        { titulo: "Ticket promedio", clave: "ticket", formato: "moneda" },
        { titulo: "Participación", clave: "parte", formato: "porcentaje" },
      ],
      filas: METODOS.map((m) => ({
        metodo: m.label,
        ventas: turno[m.v].ventas,
        monto: turno[m.v].monto,
        ticket: turno[m.v].ventas ? turno[m.v].monto / turno[m.v].ventas : 0,
        parte: totalTurno ? turno[m.v].monto / totalTurno : 0,
      })),
    },
  ];

  return (
    <div className="caja">
      <section className="caja__productos" aria-labelledby="caja-titulo">
        <div className="equipo__cabeza">
          <div>
            <p className="eyebrow">Punto de venta</p>
            <h1 id="caja-titulo">Caja</h1>
          </div>
          <button type="button" className="btn btn--secondary" onClick={() => { cargarTurno(); cierreRef.current?.showModal(); }}>
            Cierre de caja
          </button>
        </div>

        <div className="filtros__opciones caja__categorias" role="group" aria-label="Categorías">
          {grupos.map((c) => (
            <button key={c} type="button" className={`chip${cat === c ? " is-on" : ""}`} aria-pressed={cat === c} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>

        {cargando ? (
          <p className="caja__vacia" aria-busy="true">Cargando productos…</p>
        ) : (
          <div className="caja__grid">
            {visibles.map((item) => {
              const agotado = item.stock <= 0;
              const bajo = !agotado && item.stock < 999 && item.stock <= Math.max(item.stock_minimo, 5);
              return (
                <button key={item.id} type="button" className="caja__item" onClick={() => agregar(item)} disabled={agotado}>
                  <span className="caja__cat">{grupoDe(item)}</span>
                  <span className="caja__nombre">{item.nombre}</span>
                  <span className="caja__precio">{formatBs(item.precio)}</span>
                  {agotado ? <span className="caja__stock">Agotado</span> : bajo && <span className="caja__stock">Quedan {item.stock}</span>}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <aside className="caja__orden" aria-labelledby="orden-titulo">
        <h2 id="orden-titulo">Orden actual</h2>
        <p className="caja__sub">{unidades === 1 ? "1 producto" : `${unidades} productos`}</p>

        {venta && (
          <div className="caja__comprobante" role="status">
            <strong>Venta registrada · {venta.numero}</strong>
            <span>{formatBs(venta.total)} en {venta.metodo.toLowerCase()}</span>
            <button type="button" className="link" onClick={() => pedirImpresion("venta")}>Imprimir comprobante</button>
          </div>
        )}

        {orden.length === 0 ? (
          <p className="caja__vacia">Toca un producto para agregarlo.</p>
        ) : (
          <ul className="caja__lineas">
            {orden.map((l) => (
              <li key={l.id}>
                <div>
                  <span className="caja__lnombre">{l.nombre}</span>
                  <span className="caja__lprecio">{formatBs(l.precio)}</span>
                </div>
                <div className="cantidad cantidad--sm">
                  <button type="button" aria-label={`Quitar uno de ${l.nombre}`} onClick={() => cambiar(l.id, -1)}>−</button>
                  <output>{l.qty}</output>
                  <button type="button" aria-label={`Agregar uno de ${l.nombre}`} onClick={() => cambiar(l.id, 1)}>+</button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="caja__pago">
          <div className="segmentado" role="radiogroup" aria-label="Método de pago">
            {METODOS.map((m) => (
              <button key={m.v} type="button" role="radio" aria-checked={metodo === m.v} className={metodo === m.v ? "is-on" : ""} onClick={() => setMetodo(m.v)}>
                {m.label}
              </button>
            ))}
          </div>
          <div className="caja__total">
            <span>Total</span>
            <strong>{formatBs(total)}</strong>
          </div>
          {error && <p className="carrito__error" role="alert">{error}</p>}
          <button type="button" className="btn btn--primary caja__cobrar" disabled={!orden.length || cobrando} onClick={cobrar}>
            {cobrando ? "Cobrando…" : `Cobrar ${orden.length ? formatBs(total) : ""}`}
          </button>
        </div>
      </aside>

      <dialog ref={cierreRef} className="dialogo" aria-labelledby="cierre-titulo">
        <div className="dialogo__cabeza">
          <h2 id="cierre-titulo">Cierre de caja</h2>
          <button type="button" className="carrito__cerrar" aria-label="Cerrar" onClick={() => cierreRef.current?.close()}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.6" /></svg>
          </button>
        </div>
        <p className="caja__sub">Ventas de hoy, {new Date().toLocaleDateString("es-BO", { weekday: "long", day: "numeric", month: "long" })}</p>
        <ul className="dialogo__filas">
          {METODOS.map((m) => (
            <li key={m.v}>
              <span>
                {m.label}
                <small>{turno[m.v].ventas === 1 ? "1 venta" : `${turno[m.v].ventas} ventas`}</small>
              </span>
              <strong>{formatBs(turno[m.v].monto)}</strong>
            </li>
          ))}
          <li className="dialogo__total">
            <span>Total del día</span>
            <strong>{formatBs(totalTurno)}</strong>
          </li>
        </ul>
        <BotonesDocumento
          concepto="cierre-de-caja"
          tituloPdf="Cierre de caja - Grano y Aroma"
          hojas={hojasCierre}
          alImprimir={() => pedirImpresion("cierre")}
        />
      </dialog>

      {/* Los dos documentos en papel. Solo el que se pidió lleva la clase imprimible. */}
      {venta && (
        <HojaDocumento
          className={`solo-papel${impresion?.tipo === "venta" ? " imprimible" : ""}`}
          titulo="Comprobante de venta"
          subtitulo={`Atención en caja · ${venta.hora}`}
          numero={venta.numero}
          etiquetaNumero="Venta"
        >
          <section className="doc__bloque">
            <table className="doc__tabla">
              <thead>
                <tr>
                  <th scope="col">Producto</th>
                  <th scope="col" className="num">Cantidad</th>
                  <th scope="col" className="num">Precio</th>
                  <th scope="col" className="num">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {venta.lineas.map((l, i) => (
                  <tr key={`${l.nombre}-${i}`}>
                    <td>
                      {l.nombre}
                      <small>{l.categoria}</small>
                    </td>
                    <td className="num">{l.qty}</td>
                    <td className="num">{formatBs(l.precio)}</td>
                    <td className="num">{formatBs(l.precio * l.qty)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Método de pago</td>
                  <td className="num">{venta.metodo}</td>
                </tr>
                <tr className="doc__gran-total">
                  <td colSpan={3}>Total</td>
                  <td className="num">{formatBs(venta.total)}</td>
                </tr>
              </tfoot>
            </table>
          </section>
          <p className="doc__sub">Gracias por su compra.</p>
        </HojaDocumento>
      )}

      <HojaDocumento
        className={`solo-papel${impresion?.tipo === "cierre" ? " imprimible" : ""}`}
        titulo="Cierre de caja"
        subtitulo="Ventas del día en caja"
        numero={`CC-${fechaISO()}`}
        etiquetaNumero="Cierre"
      >
        <section className="doc__bloque">
          <table className="doc__tabla">
            <thead>
              <tr>
                <th scope="col">Método de pago</th>
                <th scope="col" className="num">Ventas</th>
                <th scope="col" className="num">Ticket promedio</th>
                <th scope="col" className="num">Monto</th>
              </tr>
            </thead>
            <tbody>
              {METODOS.map((m) => (
                <tr key={m.v}>
                  <td>{m.label}</td>
                  <td className="num">{turno[m.v].ventas}</td>
                  <td className="num">{formatBs(turno[m.v].ventas ? turno[m.v].monto / turno[m.v].ventas : 0)}</td>
                  <td className="num">{formatBs(turno[m.v].monto)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="doc__gran-total">
                <td>Total del día</td>
                <td className="num">{ventasTurno}</td>
                <td className="num" />
                <td className="num">{formatBs(totalTurno)}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        <section className="doc__bloque">
          <h3>Conformidad</h3>
          <dl className="doc__datos">
            <div><dt>Cajero</dt><dd>_______________________</dd></div>
            <div><dt>Supervisor</dt><dd>_______________________</dd></div>
          </dl>
        </section>
      </HojaDocumento>
    </div>
  );
}
