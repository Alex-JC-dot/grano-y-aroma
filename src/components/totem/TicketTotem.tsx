"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatBs } from "@/lib/utils";

/**
 * El ticket del tótem, en formato de impresora térmica de 80 mm (la de los cajeros).
 *
 * Se dibuja dos veces: una vista previa en pantalla (por si no hay impresora) y una copia
 * para el papel, montada como hija directa de <body> con la clase "imprimible": así la hoja de
 * impresión (imprimir.css) oculta todo lo demás y usa la página "ticket" de 80 mm de ancho.
 * En Android sale por el diálogo de impresión de Chrome o, con la app RawBT, directo a una
 * impresora térmica Bluetooth/USB.
 */

export type DatosTicket = {
  turno: number;
  codigo: string;
  fecha: Date;
  lineas: { nombre: string; detalle?: string; cantidad: number; precio: number }[];
  /** "Para aquí" o "Para llevar". */
  modo: string;
  total: number;
  pago: string;
};

const turnoTexto = (n: number) => `#${String(n).padStart(3, "0")}`;

function QrTicket({ texto }: { texto: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let vivo = true;
    import("qrcode").then((qr) =>
      qr.toString(texto, { type: "svg", margin: 0, color: { dark: "#000000", light: "#ffffff" } }).then((s) => vivo && setSvg(s)),
    );
    return () => {
      vivo = false;
    };
  }, [texto]);
  return <div className="ticket__qr" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function Contenido({ d }: { d: DatosTicket }) {
  const fecha = d.fecha.toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric" });
  const hora = d.fecha.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", hour12: false });
  return (
    <>
      <p className="ticket__marca">GRANO Y AROMA</p>
      <p className="ticket__sub">Café de especialidad · Sucre</p>
      <p className="ticket__sub">Autoservicio · Tótem</p>
      <hr />
      <p className="ticket__turno-et">TU NÚMERO DE PEDIDO</p>
      <p className="ticket__turno">{turnoTexto(d.turno)}</p>
      <p className="ticket__modo">{d.modo.toUpperCase()}</p>
      <p className="ticket__sub">{fecha} · {hora} · {d.codigo}</p>
      <hr />
      <table className="ticket__lineas">
        <tbody>
          {d.lineas.map((l, k) => (
            <tr key={k}>
              <td>{l.cantidad} × {l.nombre}{l.detalle && <small>{l.detalle}</small>}</td>
              <td>{formatBs(l.precio * l.cantidad)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <hr />
      <p className="ticket__total"><span>TOTAL</span><span>{formatBs(d.total)}</span></p>
      <p className="ticket__sub">{d.pago} · APROBADO</p>
      <hr />
      <p className="ticket__aviso">Retira tu pedido en la BARRA cuando llamen tu número.</p>
      <QrTicket texto="https://grano-y-aroma-a0i0.onrender.com/" />
      <p className="ticket__sub">¡Gracias por tu visita!</p>
    </>
  );
}

/** Vista previa en pantalla. */
export function TicketVista({ datos }: { datos: DatosTicket }) {
  return (
    <div className="ticket ticket--vista">
      <Contenido d={datos} />
    </div>
  );
}

/** Copia para imprimir (invisible en pantalla). */
export function TicketImpresion({ datos }: { datos: DatosTicket }) {
  const [montado, setMontado] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setMontado(true), 0);
    return () => window.clearTimeout(t);
  }, []);
  if (!montado) return null;
  return createPortal(
    <div className="ticket ticket-80 imprimible">
      <Contenido d={datos} />
    </div>,
    document.body,
  );
}

export { turnoTexto };
