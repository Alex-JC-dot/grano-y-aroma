"use client";

import { useState } from "react";
import { inventoryItems } from "@/lib/data";
import BotonesDocumento from "@/components/ui/BotonesDocumento";
import { fechaISO } from "@/lib/documento";
import HojaDocumento from "@/components/ui/HojaDocumento";
import type { HojaExcel } from "@/lib/excel";

/**
 * Bodega y tueste: inventario de café verde, tostado e insumos con alerta de stock mínimo
 * (RF-22, RF-23) y registro de lotes de tueste con código de trazabilidad (RF-24 a RF-26).
 * Datos de prueba hasta conectar Supabase.
 */

type Registro = {
  id: string;
  fecha: string;
  verde: string;
  kg: string;
  perfil: string;
  puntaje: number;
  notas: string;
  lote: string;
};

const REGISTROS: Registro[] = [
  { id: "RT-001", fecha: "2025-10-07", verde: "VS-2025-GRN-012", kg: "12", perfil: "Ligero · 195 °C pico · 11:30 min", puntaje: 87.5, notas: "Excelente desarrollo. Acidez brillante.", lote: "VS-2025-NAT-001" },
  { id: "RT-002", fecha: "2025-10-03", verde: "PAD-2025-GRN-009", kg: "15", perfil: "Medio · 205 °C pico · 13:00 min", puntaje: 86.0, notas: "Tueste balanceado. Notas a caramelo.", lote: "PAD-2025-WAS-003" },
  { id: "RT-003", fecha: "2025-09-28", verde: "COR-2025-GRN-004", kg: "20", perfil: "Oscuro · 215 °C pico · 14:30 min", puntaje: 85.0, notas: "Para espresso. Full City+.", lote: "COR-2025-DAR-002" },
];

const TIPOS = { verde: "Café verde", tostado: "Café tostado", insumo: "Insumos" } as const;
const APTO_SUBASTA = 87; // puntaje mínimo para ofrecer un lote en subasta

type Form = { verde: string; kg: string; perfil: string; puntaje: string; notas: string };
const FORM_VACIO: Form = { verde: "", kg: "", perfil: "", puntaje: "", notas: "" };

export default function PaginaBodega() {
  const [pestana, setPestana] = useState<"inventario" | "tueste">("inventario");
  const [registros, setRegistros] = useState(REGISTROS);
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState<Form>(FORM_VACIO);
  const [errores, setErrores] = useState<Partial<Record<keyof Form, string>>>({});
  const [aviso, setAviso] = useState("");

  const guardar = () => {
    const e: typeof errores = {};
    if (!/^[A-Z]{2,4}-\d{4}-GRN-\d{3}$/.test(form.verde.trim().toUpperCase())) e.verde = "Escribe el código del lote verde, por ejemplo VS-2025-GRN-012.";
    if (!(Number(form.kg) > 0)) e.kg = "Escribe los kilos tostados.";
    if (!form.perfil.trim()) e.perfil = "Describe el perfil: nivel, temperatura pico y tiempo.";
    const p = Number(form.puntaje.replace(",", "."));
    if (!(p >= 60 && p <= 100)) e.puntaje = "Escribe un puntaje entre 60 y 100.";
    setErrores(e);
    if (Object.keys(e).length) return;

    // Código de trazabilidad: prefijo del lote verde + año + número correlativo.
    const verde = form.verde.trim().toUpperCase();
    const [pref, anio] = verde.split("-");
    const n = String(registros.length + 1).padStart(3, "0");
    const lote = `${pref}-${anio}-TOS-${n}`;
    const nuevo: Registro = {
      id: `RT-${n}`,
      fecha: fechaISO(),
      verde,
      kg: form.kg,
      perfil: form.perfil.trim(),
      puntaje: p,
      notas: form.notas.trim(),
      lote,
    };
    setRegistros((r) => [nuevo, ...r]);
    setForm(FORM_VACIO);
    setAbierto(false);
    setAviso(`Lote ${lote} registrado${p >= APTO_SUBASTA ? ". Es apto para subasta." : "."}`);
  };

  /**
   * Las dos hojas del libro: inventario y lotes de tueste.
   *
   * La columna "Faltante" no está en la pantalla y sí en el Excel a propósito: es la resta
   * entre el mínimo y lo que hay, y es justo el número con el que se arma una orden de
   * compra. En pantalla basta con la alerta; en la planilla hace falta la cifra.
   */
  const hojasExcel = (): HojaExcel[] => [
    {
      nombre: "Inventario",
      columnas: [
        { titulo: "Insumo", clave: "nombre" },
        { titulo: "Tipo", clave: "tipo" },
        { titulo: "Origen", clave: "origen" },
        { titulo: "Lote", clave: "lote" },
        { titulo: "Cantidad", clave: "cantidad", formato: "numero" },
        { titulo: "Unidad", clave: "unidad" },
        { titulo: "Stock mínimo", clave: "minimo", formato: "numero" },
        { titulo: "Faltante", clave: "faltante", formato: "numero" },
        { titulo: "Estado", clave: "estado" },
      ],
      filas: inventoryItems.map((i) => ({
        nombre: i.name,
        tipo: TIPOS[i.type],
        origen: i.origin ?? "",
        lote: i.lotCode ?? "",
        cantidad: i.quantity,
        unidad: i.unit,
        minimo: i.minStock,
        faltante: Math.max(0, i.minStock - i.quantity),
        estado: i.quantity < i.minStock ? "Bajo el mínimo" : "Suficiente",
      })),
    },
    {
      nombre: "Lotes de tueste",
      columnas: [
        { titulo: "Registro", clave: "id" },
        { titulo: "Fecha", clave: "fecha", formato: "fecha" },
        { titulo: "Café verde", clave: "verde" },
        { titulo: "Kilos", clave: "kg", formato: "numero" },
        { titulo: "Perfil de tueste", clave: "perfil" },
        { titulo: "Puntaje", clave: "puntaje", formato: "numero" },
        { titulo: "Apto para subasta", clave: "apto" },
        { titulo: "Código de trazabilidad", clave: "lote" },
        { titulo: "Notas de catación", clave: "notas" },
      ],
      filas: registros.map((r) => ({
        id: r.id,
        fecha: new Date(r.fecha + "T12:00:00"),
        verde: r.verde,
        kg: Number(r.kg),
        perfil: r.perfil,
        puntaje: r.puntaje,
        apto: r.puntaje >= APTO_SUBASTA ? "Sí" : "No",
        lote: r.lote,
        notas: r.notas,
      })),
    },
  ];

  const campo = (k: keyof Form, etiqueta: string, ayuda: string, tipo = "text") => (
    <div className="carrito__campo">
      <label htmlFor={`t-${k}`}>{etiqueta}</label>
      <input
        id={`t-${k}`}
        type={tipo}
        inputMode={tipo === "number" ? "decimal" : undefined}
        value={form[k]}
        placeholder={ayuda}
        onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
        aria-invalid={errores[k] ? true : undefined}
        aria-describedby={errores[k] ? `t-${k}-e` : undefined}
      />
      {errores[k] && <p id={`t-${k}-e`} className="carrito__error">{errores[k]}</p>}
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

      <div className="equipo__acciones erp__descargas">
        <BotonesDocumento
          concepto={pestana === "inventario" ? "inventario" : "lotes-de-tueste"}
          tituloPdf="Bodega y tueste - Grano y Aroma"
          hojas={hojasExcel}
        />
      </div>

      <div className="pestanas" role="tablist" aria-label="Secciones">
        {(["inventario", "tueste"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={pestana === t} className={pestana === t ? "is-on" : ""} onClick={() => setPestana(t)}>
            {t === "inventario" ? "Inventario" : "Registro de tueste"}
          </button>
        ))}
      </div>

      {pestana === "inventario" ? (
        <>
          <div className="tarjetas-dato">
            {(Object.keys(TIPOS) as (keyof typeof TIPOS)[]).map((t) => {
              const items = inventoryItems.filter((i) => i.type === t);
              const bajos = items.filter((i) => i.quantity <= i.minStock).length;
              return (
                <div key={t} className="dato">
                  <span className="dato__label">{TIPOS[t]}</span>
                  <strong className="dato__valor">{items.length} productos</strong>
                  <span className={`dato__nota${bajos ? " is-alerta" : ""}`}>
                    {bajos ? `${bajos} bajo el mínimo` : "Todo en orden"}
                  </span>
                </div>
              );
            })}
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
                {inventoryItems.map((i) => {
                  const bajo = i.quantity <= i.minStock;
                  return (
                    <tr key={i.id}>
                      <td>
                        {i.name}
                        {i.lotCode && <small>{i.lotCode}</small>}
                      </td>
                      <td>{TIPOS[i.type]}</td>
                      <td className="num">{i.quantity} {i.unit}</td>
                      <td className="num">{i.minStock} {i.unit}</td>
                      <td><span className={`estado ${bajo ? "estado--pausada" : ""}`}>{bajo ? "Bajo stock" : "En orden"}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="equipo__acciones">
            <p className="equipo__aviso" role="status">{aviso}</p>
            <button type="button" className="btn btn--primary" aria-expanded={abierto} onClick={() => setAbierto((a) => !a)}>
              {abierto ? "Cerrar formulario" : "Registrar tueste"}
            </button>
          </div>

          {abierto && (
            <form className="panel tueste-form" onSubmit={(e) => { e.preventDefault(); guardar(); }} noValidate>
              <h2>Nuevo registro de tueste</h2>
              <div className="tueste-form__grid">
                {campo("verde", "Lote de café verde", "VS-2025-GRN-012")}
                {campo("kg", "Kilos tostados", "15", "number")}
                {campo("perfil", "Perfil de tueste", "Medio · 205 °C pico · 13:00 min")}
                {campo("puntaje", "Puntaje de catación", "87,5", "number")}
              </div>
              <div className="carrito__campo">
                <label htmlFor="t-notas">Notas de cata</label>
                <textarea id="t-notas" rows={2} value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} />
              </div>
              <p className="caja__sub">Al guardar se genera el código de trazabilidad del lote tostado. Con {APTO_SUBASTA} puntos o más queda apto para subasta.</p>
              <div className="equipo__fila">
                <button type="submit" className="btn btn--primary">Guardar y generar código</button>
                <button type="button" className="btn btn--secondary" onClick={() => setAbierto(false)}>Cancelar</button>
              </div>
            </form>
          )}

          <ul className="registros">
            {registros.map((r) => (
              <li key={r.id} className="registro">
                <div>
                  <p className="registro__meta">
                    {r.id} · {r.fecha}
                    {r.puntaje >= APTO_SUBASTA && <span className="estado">Apto para subasta</span>}
                  </p>
                  <h3>{r.lote}</h3>
                  <p className="registro__detalle">Verde {r.verde} · {r.kg} kg · {r.perfil}</p>
                  {r.notas && <p className="registro__notas">“{r.notas}”</p>}
                </div>
                <div className="registro__puntaje">
                  <strong>{r.puntaje.toLocaleString("es-BO", { minimumFractionDigits: 1 })}</strong>
                  <span>puntos</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {/* Versión en papel: inventario y lotes de tueste en un solo documento. */}
      <HojaDocumento
        className="solo-papel imprimible"
        titulo="Bodega y producción"
        subtitulo="Inventario actual y registro de lotes de tueste"
        numero={`BP-${fechaISO()}`}
        etiquetaNumero="Reporte"
        aviso="Datos de demostración: el inventario definitivo se descontará con cada venta registrada."
      >
        <section className="doc__bloque">
          <h3>Inventario</h3>
          <table className="doc__tabla">
            <thead>
              <tr>
                <th scope="col">Insumo</th>
                <th scope="col">Tipo</th>
                <th scope="col" className="num">Cantidad</th>
                <th scope="col" className="num">Mínimo</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {inventoryItems.map((i) => (
                <tr key={i.id}>
                  <td>
                    {i.name}
                    {i.origin && <small>{i.origin}</small>}
                  </td>
                  <td>{TIPOS[i.type]}</td>
                  <td className="num">{i.quantity} {i.unit}</td>
                  <td className="num">{i.minStock} {i.unit}</td>
                  <td>{i.quantity < i.minStock ? "Bajo el mínimo" : "Suficiente"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="doc__bloque">
          <h3>Lotes de tueste</h3>
          <table className="doc__tabla">
            <thead>
              <tr>
                <th scope="col">Lote</th>
                <th scope="col">Fecha</th>
                <th scope="col">Perfil</th>
                <th scope="col" className="num">Puntaje</th>
                <th scope="col" className="num">Kilos</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.lote}
                    <small>de {r.verde}</small>
                  </td>
                  <td>{r.fecha}</td>
                  <td>
                    {r.perfil}
                    {r.notas && <small>{r.notas}</small>}
                  </td>
                  <td className="num">{r.puntaje.toFixed(1)}</td>
                  <td className="num">{r.kg} kg</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </HojaDocumento>
    </div>
  );
}
