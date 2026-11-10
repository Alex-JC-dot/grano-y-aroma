"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { EMPRESA, fechaHoraLarga } from "@/lib/documento";

/**
 * Membrete y pie comunes a todo lo que el sistema entrega en papel o PDF: comprobantes de
 * compra y de venta, cierres de caja y reportes.
 *
 * Que todos los documentos salgan con la misma cabecera no es estética: es lo que hace que
 * una hoja impresa se reconozca como emitida por el sistema y no como una captura de
 * pantalla.
 *
 * EL DOCUMENTO SE MONTA EN <body> MEDIANTE UN PORTAL, y eso resuelve un problema real.
 *
 * El primer intento ocultaba el resto de la página con visibility:hidden. Pero visibility
 * esconde el contenido y CONSERVA SU CAJA: una ficha de producto larga seguía midiendo lo
 * que medía, así que el navegador generaba seis hojas y solo la primera traía algo. Las
 * otras cinco salían en blanco.
 *
 * Con el portal, el documento deja de estar enterrado dentro del árbol de la página y pasa
 * a ser hermano de todo lo demás, colgando directamente de <body>. Entonces la hoja de
 * impresión puede ocultar a sus hermanos con display:none —que sí colapsa la altura— y el
 * PDF sale con exactamente las páginas que ocupa el documento.
 *
 * `aviso` imprime la leyenda de datos de demostración. Mientras las cifras no salgan de
 * ventas reales, esa línea debe ir en el papel: un reporte que no se distingue de uno real
 * es un problema, no un detalle.
 */

// En el servidor no hay document, así que el portal no puede crearse hasta que monte.
// useSyncExternalStore con dos lecturas distintas lo resuelve sin desajuste de hidratación.
const sinSuscripcion = () => () => {};
const enNavegador = () => true;
const enServidor = () => false;

export default function HojaDocumento({
  titulo,
  subtitulo,
  numero,
  etiquetaNumero = "Documento",
  aviso,
  className = "",
  children,
}: {
  titulo: string;
  subtitulo?: string;
  numero?: string;
  etiquetaNumero?: string;
  aviso?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const montado = useSyncExternalStore(sinSuscripcion, enNavegador, enServidor);
  if (!montado) return null;

  // El documento vive fuera de la pantalla hasta que se imprime. Dejarlo en el árbol de
  // accesibilidad haría que un lector de pantalla leyera dos veces la misma información.
  const soloParaPapel = className.includes("solo-papel");

  return createPortal(
    <article className={`doc ${className}`.trim()} aria-hidden={soloParaPapel || undefined}>
      <header className="doc__cabecera">
        <div className="doc__marca">
          {EMPRESA.nombre}
          <small>{EMPRESA.rubro}</small>
        </div>
        <div className="doc__meta">
          {numero && (
            <strong>
              {etiquetaNumero} {numero}
            </strong>
          )}
          <span>{fechaHoraLarga()}</span>
        </div>
      </header>

      <h2 className="doc__titulo">{titulo}</h2>
      {subtitulo && <p className="doc__sub">{subtitulo}</p>}

      {children}

      <footer className="doc__pie">
        <p>
          {EMPRESA.nombre} · {EMPRESA.direccion}
        </p>
        <p>
          WhatsApp {EMPRESA.whatsapp} · {EMPRESA.correo}
        </p>
        {aviso && <p className="doc__aviso">{aviso}</p>}
      </footer>
    </article>,
    document.body
  );
}
