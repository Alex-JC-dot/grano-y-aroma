"use client";

import { useEffect, useRef, useState } from "react";
import { posItems } from "@/lib/data";
import type { POSItem } from "@/lib/types";
import { formatBs } from "@/lib/utils";
import HojaDocumento from "@/components/ui/HojaDocumento";
import BotonesDocumento from "@/components/ui/BotonesDocumento";
import { fechaISO, imprimirDocumento, numeroDocumento } from "@/lib/documento";
import type { HojaExcel } from "@/lib/excel";

/**
 * Caja de la cafetería (Punto de Venta): productos por categoría, orden actual, método de
 * pago, comprobante de venta (RF-18) y cierre de caja del turno (RF-19).
 *
 * La caja emite dos documentos distintos y solo uno puede estar marcado como imprimible a
 * la vez: si los dos lo estuvieran, el diálogo de impresión sacaría los dos en la misma
 * hoja. Por eso `impresion` decide cuál se marca, y lleva un contador además del tipo:
 * sin él, pedir dos veces seguidas el mismo documento no cambiaría el estado y la segunda
 * impresión no se dispararía.
 *
 * Los datos son de prueba; el descuento de stock compartido con la tienda queda pendiente
 * de una fuente de datos común (RF-21).
 */

type Linea = POSItem & { qty: number };
type Metodo = "efectivo" | "qr" | "tarjeta";
const METODOS: { v: Metodo; label: string }[] = [
  { v: "efectivo", label: "Efectivo" },
  { v: "qr", label: "QR" },
  { v: "tarjeta", label: "Tarjeta" },
];
const CATEGORIAS = ["Todos", ...Array.from(new Set(posItems.map((i) => i.category)))];

// Ventas del turno antes de abrir la pantalla (datos de prueba).
const TURNO_INICIAL: Record<Metodo, { monto: number; ventas: number }> = {
  efectivo: { monto: 1240, ventas: 18 },
  qr: { monto: 890, ventas: 12 },
  tarjeta: { monto: 430, ventas: 5 },
};

/** Lo que queda de una venta cobrada: la orden se vacía enseguida. */
type Venta = {
  numero: string;
  hora: string;
  lineas: { nombre: string; categoria: string; qty: number; precio: number }[];
  total: number;
  metodo: string;
};

export default function PaginaCaja() {
  const [cat, setCat] = useState("Todos");
  const [orden, setOrden] = useState<Linea[]>([]);
  const [metodo, setMetodo] = useState<Metodo>("efectivo");
  const [turno, setTurno] = useState(TURNO_INICIAL);
  const [venta, setVenta] = useState<Venta | null>(null);
  const [impresion, setImpresion] = useState<{ tipo: "venta" | "cierre"; n: number } | null>(null);
  const cierreRef = useRef<HTMLDialogElement>(null);

  const visibles = posItems.filter((i) => cat === "Todos" || i.category === cat);
  const total = orden.reduce((s, i) => s + i.price * i.qty, 0);
  const unidades = orden.reduce((s, i) => s + i.qty, 0);
  const totalTurno = Object.values(turno).reduce((s, x) => s + x.monto, 0);
  const ventasTurno = Object.values(turno).reduce((s, x) => s + x.ventas, 0);

  // Imprime cuando el documento ya está marcado en el DOM, no antes.
  useEffect(() => {
    if (!impresion) return;
    const titulo =
      impresion.tipo === "venta"
        ? `Comprobante ${venta?.numero ?? ""} - Grano y Aroma`
        : "Cierre de caja - Grano y Aroma";
    imprimirDocumento(titulo);
  }, [impresion, venta]);

  const pedirImpresion = (tipo: "venta" | "cierre") =>
    setImpresion((previa) => ({ tipo, n: (previa?.n ?? 0) + 1 }));

  const agregar = (item: POSItem) => {
    setVenta(null);
    setOrden((o) =>
      o.some((x) => x.id === item.id)
        ? o.map((x) => (x.id === item.id ? { ...x, qty: x.qty + 1 } : x))
        : [...o, { ...item, qty: 1 }]
    );
  };
  const cambiar = (id: string, d: number) =>
    setOrden((o) => o.map((x) => (x.id === id ? { ...x, qty: x.qty + d } : x)).filter((x) => x.qty > 0));

  const cobrar = () => {
    setTurno((t) => ({ ...t, [metodo]: { monto: t[metodo].monto + total, ventas: t[metodo].ventas + 1 } }));
    // El detalle se copia ANTES de vaciar la orden; si no, el comprobante saldría vacío.
    setVenta({
      numero: numeroDocumento("C", 5),
      hora: new Date().toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", hour12: false }),
      lineas: orden.map((l) => ({ nombre: l.name, categoria: l.category, qty: l.qty, precio: l.price })),
      total,
      metodo: METODOS.find((m) => m.v === metodo)!.label,
    });
    setOrden([]);
  };

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
          <button type="button" className="btn btn--secondary" onClick={() => cierreRef.current?.showModal()}>
            Cierre de caja
          </button>
        </div>

        <div className="filtros__opciones caja__categorias" role="group" aria-label="Categorías">
          {CATEGORIAS.map((c) => (
            <button key={c} type="button" className={`chip${cat === c ? " is-on" : ""}`} aria-pressed={cat === c} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>

        <div className="caja__grid">
          {visibles.map((item) => {
            const bajo = item.stock !== 999 && item.stock < 15;
            return (
              <button key={item.id} type="button" className="caja__item" onClick={() => agregar(item)}>
                <span className="caja__cat">{item.category}</span>
                <span className="caja__nombre">{item.name}</span>
                <span className="caja__precio">{formatBs(item.price)}</span>
                {bajo && <span className="caja__stock">Quedan {item.stock}</span>}
              </button>
            );
          })}
        </div>
      </section>

      <aside className="caja__orden" aria-labelledby="orden-titulo">
        <h2 id="orden-titulo">Orden actual</h2>
        <p className="caja__sub">{unidades === 1 ? "1 producto" : `${unidades} productos`}</p>

        {venta && (
          <div className="caja__comprobante" role="status">
            <strong>Venta registrada · {venta.numero}</strong>
            <span>
              {formatBs(venta.total)} en {venta.metodo.toLowerCase()}
            </span>
            <button type="button" className="link" onClick={() => pedirImpresion("venta")}>
              Imprimir comprobante
            </button>
          </div>
        )}

        {orden.length === 0 ? (
          <p className="caja__vacia">Toca un producto para agregarlo.</p>
        ) : (
          <ul className="caja__lineas">
            {orden.map((l) => (
              <li key={l.id}>
                <div>
                  <span className="caja__lnombre">{l.name}</span>
                  <span className="caja__lprecio">{formatBs(l.price)}</span>
                </div>
                <div className="cantidad cantidad--sm">
                  <button type="button" aria-label={`Quitar uno de ${l.name}`} onClick={() => cambiar(l.id, -1)}>−</button>
                  <output>{l.qty}</output>
                  <button type="button" aria-label={`Agregar uno de ${l.name}`} onClick={() => cambiar(l.id, 1)}>+</button>
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
          <button type="button" className="btn btn--primary caja__cobrar" disabled={!orden.length} onClick={cobrar}>
            Cobrar {orden.length ? formatBs(total) : ""}
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
        <p className="caja__sub">Turno de 08:00 a 18:00</p>
        <ul className="dialogo__filas">
          {METODOS.map((m) => (
            <li key={m.v}>
              <span>
                {m.label}
                <small>{turno[m.v].ventas} ventas</small>
              </span>
              <strong>{formatBs(turno[m.v].monto)}</strong>
            </li>
          ))}
          <li className="dialogo__total">
            <span>Total del turno</span>
            <strong>{formatBs(totalTurno)}</strong>
          </li>
        </ul>
        <BotonesDocumento
          concepto="cierre-de-caja"
          tituloPdf="Cierre de caja - Grano y Aroma"
          hojas={hojasCierre}
          etiquetaPdf="Descargar PDF"
          alImprimir={() => pedirImpresion("cierre")}
        />
      </dialog>

      {/*
        Los dos documentos en papel. Solo el que pidió el usuario lleva la clase imprimible:
        si la llevaran los dos, saldrían juntos en la misma hoja.
      */}
      {venta && (
        <HojaDocumento
          className={`solo-papel${impresion?.tipo === "venta" ? " imprimible" : ""}`}
          titulo="Comprobante de venta"
          subtitulo={`Atención en caja · ${venta.hora}`}
          numero={venta.numero}
          etiquetaNumero="Venta"
          aviso="Comprobante de demostración: esta venta no generó ningún cobro real."
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
        subtitulo="Turno de 08:00 a 18:00"
        numero={`CC-${fechaISO()}`}
        etiquetaNumero="Cierre"
        aviso="Cifras de demostración: el turno parte de datos de prueba."
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
                <td>Total del turno</td>
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
