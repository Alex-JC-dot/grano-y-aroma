"use client";

import { useRef, useState } from "react";
import { posItems } from "@/lib/data";
import type { POSItem } from "@/lib/types";
import { formatBs } from "@/lib/utils";

/**
 * Caja de la cafetería (Punto de Venta, RF-17 a RF-21): productos por categoría, orden actual,
 * método de pago, cobro con comprobante y cierre de caja del turno.
 * Los datos son de prueba; el descuento de stock compartido con la tienda vendrá de Supabase.
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

export default function PaginaCaja() {
  const [cat, setCat] = useState("Todos");
  const [orden, setOrden] = useState<Linea[]>([]);
  const [metodo, setMetodo] = useState<Metodo>("efectivo");
  const [turno, setTurno] = useState(TURNO_INICIAL);
  const [comprobante, setComprobante] = useState<{ n: string; total: number; metodo: string } | null>(null);
  const cierreRef = useRef<HTMLDialogElement>(null);

  const visibles = posItems.filter((i) => cat === "Todos" || i.category === cat);
  const total = orden.reduce((s, i) => s + i.price * i.qty, 0);
  const unidades = orden.reduce((s, i) => s + i.qty, 0);

  const agregar = (item: POSItem) => {
    setComprobante(null);
    setOrden((o) => (o.some((x) => x.id === item.id) ? o.map((x) => (x.id === item.id ? { ...x, qty: x.qty + 1 } : x)) : [...o, { ...item, qty: 1 }]));
  };
  const cambiar = (id: string, d: number) =>
    setOrden((o) => o.map((x) => (x.id === id ? { ...x, qty: x.qty + d } : x)).filter((x) => x.qty > 0));

  const cobrar = () => {
    setTurno((t) => ({ ...t, [metodo]: { monto: t[metodo].monto + total, ventas: t[metodo].ventas + 1 } }));
    setComprobante({ n: `C-${Date.now().toString().slice(-5)}`, total, metodo: METODOS.find((m) => m.v === metodo)!.label });
    setOrden([]);
  };

  const totalTurno = Object.values(turno).reduce((s, x) => s + x.monto, 0);

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

        {comprobante && (
          <div className="caja__comprobante" role="status">
            <strong>Venta registrada · {comprobante.n}</strong>
            <span>{formatBs(comprobante.total)} en {comprobante.metodo.toLowerCase()}</span>
            <button type="button" className="link" onClick={() => window.print()}>Imprimir comprobante</button>
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
        <button type="button" className="btn btn--primary" onClick={() => window.print()}>Imprimir reporte</button>
      </dialog>
    </div>
  );
}
