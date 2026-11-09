"use client";

import Link from "next/link";
import { useState } from "react";
import { formatBs } from "@/lib/utils";

/**
 * Panel general del administrador (RF-33 a RF-36): indicadores, ventas por canal y
 * rentabilidad por lote de tueste. Cifras de prueba hasta que los reportes salgan de Supabase.
 */

type Periodo = "semana" | "mes" | "anio";
const PERIODOS: { v: Periodo; label: string; factor: number }[] = [
  { v: "semana", label: "Semana", factor: 0.25 },
  { v: "mes", label: "Mes", factor: 1 },
  { v: "anio", label: "Año", factor: 11.4 },
];

const CANALES = [
  { canal: "Tienda en línea", monto: 8420, pedidos: 67 },
  { canal: "Caja de la cafetería", monto: 6350, pedidos: 89 },
  { canal: "Club (suscripciones)", monto: 4200, pedidos: 42 },
  { canal: "Subastas", monto: 2100, pedidos: 8 },
];

const LOTES = [
  { lote: "VS-2025-NAT-001", verde: 120, tostado: 102, vendido: 87, ingreso: 5440, costo: 2100 },
  { lote: "PAD-2025-WAS-003", verde: 150, tostado: 127, vendido: 110, ingreso: 4900, costo: 1800 },
  { lote: "COR-2025-DAR-002", verde: 200, tostado: 170, vendido: 142, ingreso: 3890, costo: 1600 },
];

const ATAJOS = [
  { href: "/pos", label: "Abrir la caja" },
  { href: "/erp", label: "Ver bodega y tueste" },
  { href: "/logistica", label: "Ver pedidos" },
  { href: "/subastas", label: "Ver subastas" },
];

export default function PaginaPanel() {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const f = PERIODOS.find((p) => p.v === periodo)!.factor;

  const canales = CANALES.map((c) => ({ ...c, monto: Math.round(c.monto * f), pedidos: Math.round(c.pedidos * f) }));
  const ingresos = canales.reduce((s, c) => s + c.monto, 0);
  const pedidos = canales.reduce((s, c) => s + c.pedidos, 0);
  const max = Math.max(...canales.map((c) => c.monto));

  const datos = [
    { label: "Ingresos", valor: formatBs(ingresos) },
    { label: "Pedidos", valor: pedidos.toLocaleString("es-BO") },
    { label: "Ticket promedio", valor: formatBs(ingresos / pedidos) },
    { label: "Kg vendidos", valor: `${Math.round(339 * f).toLocaleString("es-BO")} kg` },
  ];

  return (
    <div className="equipo__pagina">
      <div className="equipo__cabeza">
        <div>
          <p className="eyebrow">Administración</p>
          <h1>Panel general</h1>
        </div>
        <div className="segmentado" role="radiogroup" aria-label="Período">
          {PERIODOS.map((p) => (
            <button key={p.v} type="button" role="radio" aria-checked={periodo === p.v} className={periodo === p.v ? "is-on" : ""} onClick={() => setPeriodo(p.v)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="tarjetas-dato tarjetas-dato--4">
        {datos.map((d) => (
          <div key={d.label} className="dato">
            <span className="dato__label">{d.label}</span>
            <strong className="dato__valor">{d.valor}</strong>
          </div>
        ))}
      </div>

      <div className="equipo__dos">
        <section className="panel" aria-labelledby="canales-titulo">
          <h2 id="canales-titulo">Ventas por canal</h2>
          <ul className="barras">
            {canales.map((c) => (
              <li key={c.canal}>
                <div className="barras__fila">
                  <span>{c.canal}</span>
                  <span>
                    <small>{c.pedidos} pedidos</small> {formatBs(c.monto)}
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

        <section className="panel" aria-labelledby="lotes-titulo">
          <h2 id="lotes-titulo">Rentabilidad por lote</h2>
          <div className="tabla-marco tabla-marco--plano">
            <table className="tabla">
              <thead>
                <tr>
                  <th scope="col">Lote</th>
                  <th scope="col" className="num">Verde → tostado</th>
                  <th scope="col" className="num">Vendido</th>
                  <th scope="col" className="num">Margen</th>
                </tr>
              </thead>
              <tbody>
                {LOTES.map((l) => {
                  const margen = Math.round(((l.ingreso - l.costo) / l.ingreso) * 100);
                  const merma = Math.round((1 - l.tostado / l.verde) * 100);
                  return (
                    <tr key={l.lote}>
                      <td>
                        {l.lote}
                        <small>{formatBs(l.ingreso)} de ingreso</small>
                      </td>
                      <td className="num">
                        {l.verde} → {l.tostado} kg
                        <small>{merma} % de merma</small>
                      </td>
                      <td className="num">{l.vendido} kg</td>
                      <td className="num"><strong>{margen} %</strong></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <nav className="atajos" aria-label="Atajos">
        {ATAJOS.map((a) => (
          <Link key={a.href} href={a.href} className="atajo">
            {a.label} <span aria-hidden="true">→</span>
          </Link>
        ))}
      </nav>
      <p className="caja__sub">Cifras de demostración: los reportes reales se calcularán con las ventas guardadas.</p>
    </div>
  );
}
