"use client";

import { useState } from "react";
import { orders as PEDIDOS } from "@/lib/data";
import type { Order } from "@/lib/types";
import { formatBs } from "@/lib/utils";

/**
 * Logística (RF-29 a RF-31): pedidos por estado, detalle con su avance y botón para pasar
 * al siguiente estado. Con Supabase cada cambio avisará al cliente.
 */

const ESTADOS: Order["status"][] = ["Recibido", "En Preparación", "En Camino", "Entregado"];
const CLASE: Record<Order["status"], string> = {
  Recibido: "estado--recibido",
  "En Preparación": "estado--pausada",
  "En Camino": "estado--camino",
  Entregado: "",
};

export default function PaginaLogistica() {
  const [pedidos, setPedidos] = useState(PEDIDOS);
  const [elegidoId, setElegidoId] = useState<string | null>(PEDIDOS[0]?.id ?? null);
  const [filtro, setFiltro] = useState<Order["status"] | "Todos">("Todos");
  const elegido = pedidos.find((p) => p.id === elegidoId) ?? null;

  const avanzar = (id: string) =>
    setPedidos((ps) =>
      ps.map((p) => {
        const i = ESTADOS.indexOf(p.status);
        return p.id === id && i < ESTADOS.length - 1 ? { ...p, status: ESTADOS[i + 1] } : p;
      }),
    );

  const lista = pedidos.filter((p) => filtro === "Todos" || p.status === filtro);

  return (
    <div className="equipo__pagina">
      <div className="equipo__cabeza">
        <div>
          <p className="eyebrow">Envíos</p>
          <h1>Logística</h1>
        </div>
      </div>

      <div className="tarjetas-dato tarjetas-dato--4">
        {ESTADOS.map((e) => (
          <button
            key={e}
            type="button"
            className={`dato dato--boton${filtro === e ? " is-on" : ""}`}
            aria-pressed={filtro === e}
            onClick={() => setFiltro(filtro === e ? "Todos" : e)}
          >
            <span className="dato__label">{e}</span>
            <strong className="dato__valor">{pedidos.filter((p) => p.status === e).length}</strong>
          </button>
        ))}
      </div>

      <div className="logistica">
        <ul className="pedidos" aria-label={filtro === "Todos" ? "Todos los pedidos" : `Pedidos: ${filtro}`}>
          {lista.length === 0 && <li className="caja__vacia">No hay pedidos en este estado.</li>}
          {lista.map((p) => (
            <li key={p.id}>
              <button type="button" className={`pedido${p.id === elegidoId ? " is-on" : ""}`} onClick={() => setElegidoId(p.id)}>
                <span className="pedido__fila">
                  <strong>{p.id}</strong>
                  <span className={`estado ${CLASE[p.status]}`}>{p.status}</span>
                </span>
                <span className="pedido__cliente">{p.customer}</span>
                <span className="pedido__fila pedido__meta">
                  <span>{p.address}</span>
                  <span>{formatBs(p.total)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        <section className="panel detalle" aria-live="polite">
          {elegido ? (
            <>
              <div className="panel__cabeza">
                <div>
                  <h2>{elegido.id}</h2>
                  <p className="caja__sub">{elegido.customer} · pedido a las {elegido.createdAt}</p>
                </div>
                <span className={`estado ${CLASE[elegido.status]}`}>{elegido.status}</span>
              </div>

              <ol className="avance">
                {ESTADOS.map((e, i) => (
                  <li key={e} className={i <= ESTADOS.indexOf(elegido.status) ? "is-on" : ""}>
                    <span className="avance__punto" aria-hidden="true" />
                    {e}
                  </li>
                ))}
              </ol>

              <dl className="panel__datos panel__datos--3">
                <div><dt>Productos</dt><dd>{elegido.items.join(", ")}</dd></div>
                <div><dt>Dirección</dt><dd>{elegido.address}</dd></div>
                <div><dt>Repartidor</dt><dd>{elegido.driver || "Sin asignar"}</dd></div>
              </dl>

              {elegido.status !== "Entregado" ? (
                <button type="button" className="btn btn--primary detalle__boton" onClick={() => avanzar(elegido.id)}>
                  Pasar a “{ESTADOS[ESTADOS.indexOf(elegido.status) + 1]}”
                </button>
              ) : (
                <p className="caja__comprobante"><strong>Pedido entregado</strong></p>
              )}
            </>
          ) : (
            <p className="caja__vacia">Elige un pedido para ver su detalle.</p>
          )}
        </section>
      </div>
    </div>
  );
}
