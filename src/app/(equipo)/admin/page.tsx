"use client";

import Link from "next/link";
import { useState } from "react";
import { formatBs } from "@/lib/utils";
import BotonesDocumento from "@/components/ui/BotonesDocumento";
import HojaDocumento from "@/components/ui/HojaDocumento";
import type { HojaExcel } from "@/lib/excel";

/**
 * Panel general del administrador: indicadores, ventas por canal (RF-40) y rentabilidad por
 * lote de tueste (RF-41). Cifras de prueba hasta que los reportes salgan de datos reales.
 *
 * Los reportes se descargan en Excel y en PDF. Ni el documento de visión ni ningún RF piden
 * esos formatos: es una mejora sobre el alcance y así debe figurar en la trazabilidad, no
 * como cumplimiento de un requisito.
 *
 * El bloque imprimible va al final, marcado con solo-papel: no se ve en pantalla, pero el
 * diálogo de impresión lo toma y produce el PDF con membrete.
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

  /**
   * Las hojas del libro de Excel.
   * Es una función y no un valor porque solo se ejecuta al pulsar "Descargar Excel": armar
   * las filas en cada render sería trabajo tirado en cada cambio de período.
   *
   * Los importes y los kilos van como números, nunca como texto. Es la diferencia entre un
   * reporte con el que se puede trabajar y una tabla que solo se puede mirar.
   */
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
        canal: c.canal,
        pedidos: c.pedidos,
        monto: c.monto,
        ticket: c.pedidos ? c.monto / c.pedidos : 0,
        parte: ingresos ? c.monto / ingresos : 0,
      })),
    },
    {
      nombre: "Rentabilidad por lote",
      columnas: [
        { titulo: "Lote", clave: "lote" },
        { titulo: "Verde (kg)", clave: "verde", formato: "numero" },
        { titulo: "Tostado (kg)", clave: "tostado", formato: "numero" },
        { titulo: "Merma", clave: "merma", formato: "porcentaje" },
        { titulo: "Vendido (kg)", clave: "vendido", formato: "numero" },
        { titulo: "Ingreso", clave: "ingreso", formato: "moneda" },
        { titulo: "Costo", clave: "costo", formato: "moneda" },
        { titulo: "Utilidad", clave: "utilidad", formato: "moneda" },
        { titulo: "Margen", clave: "margen", formato: "porcentaje" },
      ],
      filas: LOTES.map((l) => ({
        lote: l.lote,
        verde: l.verde,
        tostado: l.tostado,
        merma: 1 - l.tostado / l.verde,
        vendido: l.vendido,
        ingreso: l.ingreso,
        costo: l.costo,
        utilidad: l.ingreso - l.costo,
        margen: (l.ingreso - l.costo) / l.ingreso,
      })),
    },
  ];

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
        <div className="equipo__acciones">
          <BotonesDocumento
            concepto={`reporte-${periodo}`}
            tituloPdf={`Grano y Aroma - Reporte de ventas (${periodo})`}
            hojas={hojasExcel}
          />
          <div className="segmentado" role="radiogroup" aria-label="Período">
          {PERIODOS.map((p) => (
            <button key={p.v} type="button" role="radio" aria-checked={periodo === p.v} className={periodo === p.v ? "is-on" : ""} onClick={() => setPeriodo(p.v)}>
              {p.label}
            </button>
            ))}
          </div>
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

      <nav className="atajos no-imprimir" aria-label="Atajos">
        {ATAJOS.map((a) => (
          <Link key={a.href} href={a.href} className="atajo">
            {a.label} <span aria-hidden="true">→</span>
          </Link>
        ))}
      </nav>
      <p className="caja__sub no-imprimir">Cifras de demostración: los reportes reales se calcularán con las ventas guardadas.</p>

      {/* Versión en papel del reporte. Invisible en pantalla, es lo único que sale al imprimir. */}
      <HojaDocumento
        className="solo-papel imprimible"
        titulo="Reporte de ventas y producción"
        subtitulo={`Período: ${PERIODOS.find((p) => p.v === periodo)!.label.toLowerCase()}`}
        numero={`RV-${periodo.toUpperCase()}`}
        etiquetaNumero="Reporte"
        aviso="Cifras de demostración. Los reportes definitivos se calcularán a partir de las ventas registradas en el sistema."
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
                <tr key={c.canal}>
                  <td>{c.canal}</td>
                  <td className="num">{c.pedidos.toLocaleString("es-BO")}</td>
                  <td className="num">{formatBs(c.monto)}</td>
                  <td className="num">{ingresos ? Math.round((c.monto / ingresos) * 100) : 0} %</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="doc__gran-total">
                <td>Total</td>
                <td className="num">{pedidos.toLocaleString("es-BO")}</td>
                <td className="num">{formatBs(ingresos)}</td>
                <td className="num">100 %</td>
              </tr>
            </tfoot>
          </table>
        </section>

        <section className="doc__bloque">
          <h3>Rentabilidad por lote de tueste</h3>
          <table className="doc__tabla">
            <thead>
              <tr>
                <th scope="col">Lote</th>
                <th scope="col" className="num">Verde → tostado</th>
                <th scope="col" className="num">Vendido</th>
                <th scope="col" className="num">Utilidad</th>
                <th scope="col" className="num">Margen</th>
              </tr>
            </thead>
            <tbody>
              {LOTES.map((l) => (
                <tr key={l.lote}>
                  <td>{l.lote}</td>
                  <td className="num">
                    {l.verde} → {l.tostado} kg
                    <small>{Math.round((1 - l.tostado / l.verde) * 100)} % de merma</small>
                  </td>
                  <td className="num">{l.vendido} kg</td>
                  <td className="num">{formatBs(l.ingreso - l.costo)}</td>
                  <td className="num">{Math.round(((l.ingreso - l.costo) / l.ingreso) * 100)} %</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </HojaDocumento>
    </div>
  );
}
