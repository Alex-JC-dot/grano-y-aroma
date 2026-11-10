"use client";

import { useState } from "react";
import { descargarBlob, imprimirDocumento, nombreArchivo } from "@/lib/documento";
import type { HojaExcel } from "@/lib/excel";

/**
 * Los dos botones de descarga que acompañan a un reporte o comprobante: Excel y PDF.
 *
 * Decisiones:
 *
 *  - El generador de Excel entra por import() dinámico. Son unos 10 KB, poco comparado con
 *    las 600 KB de una librería, pero el principio vale igual: nada que solo se use al
 *    pulsar un botón tiene por qué viajar en la carga inicial (RNF-11).
 *
 *  - El PDF no usa librería. Se imprime el documento marcado como .imprimible y el propio
 *    navegador ofrece "Guardar como PDF". Ver imprimir.css.
 *
 *  - Los botones llevan la clase no-imprimir: no deben salir en el papel que generan.
 */
export default function BotonesDocumento({
  concepto,
  hojas,
  tituloPdf,
  etiquetaPdf = "Descargar PDF",
  alImprimir,
}: {
  /** Describe el contenido; da nombre al archivo: "ventas" → grano-y-aroma-ventas-2026-11-09.xlsx */
  concepto: string;
  /** Hojas del libro. Si se omite, no se ofrece Excel. */
  hojas?: () => HojaExcel[];
  /** Título del PDF; el navegador lo propone como nombre del archivo. */
  tituloPdf: string;
  etiquetaPdf?: string;
  /**
   * Para pantallas que emiten más de un documento, como la caja. En ellas solo uno puede
   * llevar la clase imprimible a la vez, así que la pantalla marca el suyo aquí y se encarga
   * ella de disparar la impresión cuando el marcado ya está en el DOM.
   */
  alImprimir?: () => void;
}) {
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState("");

  const descargarExcel = async () => {
    if (!hojas) return;
    setGenerando(true);
    setError("");
    try {
      const { generarXlsx } = await import("@/lib/excel");
      descargarBlob(generarXlsx(hojas()), nombreArchivo(concepto, "xlsx"));
    } catch {
      setError("No se pudo generar el Excel. Intenta de nuevo.");
    } finally {
      setGenerando(false);
    }
  };

  return (
    <div className="descargas no-imprimir">
      {hojas && (
        <button type="button" className="btn btn--secondary" onClick={descargarExcel} disabled={generando}>
          {generando ? "Generando…" : "Descargar Excel"}
        </button>
      )}
      <button
        type="button"
        className="btn btn--secondary"
        onClick={() => (alImprimir ? alImprimir() : imprimirDocumento(tituloPdf))}
      >
        {etiquetaPdf}
      </button>
      {error && (
        <p className="descargas__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
