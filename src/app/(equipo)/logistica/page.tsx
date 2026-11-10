"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatBs } from "@/lib/utils";

/**
 * Logística (RF-29 a RF-31): pedidos de la tienda en línea y de subastas desde Supabase, por
 * estado. Al pasar un pedido al siguiente estado, el cliente lo ve en "Mi cuenta". Realtime
 * trae los pedidos nuevos sin recargar.
 */

type Estado = "recibido" | "preparacion" | "en_camino" | "entregado" | "cancelado";
type Pedido = {
  id: number;
  codigo: string;
  canal: string;
  estado: Estado;
  total: number;
  nombre: string | null;
  telefono: string | null;
  direccion: string | null;
  referencia: string | null;
  repartidor: string | null;
  metodo_pago: string;
  creado_en: string;
  pedido_items: { cantidad: number; molienda: string | null; productos: { nombre: string } | null }[];
};

const ESTADOS: Estado[] = ["recibido", "preparacion", "en_camino", "entregado"];
const NOMBRE: Record<Estado, string> = {
  recibido: "Recibido",
  preparacion: "En preparación",
  en_camino: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
};
const CLASE: Record<Estado, string> = {
  recibido: "estado--recibido",
  preparacion: "estado--pausada",
  en_camino: "estado--camino",
  entregado: "",
  cancelado: "estado--pausada",
};

const productosDe = (p: Pedido) =>
  p.pedido_items.length
    ? p.pedido_items.map((i) => `${i.cantidad} × ${i.productos?.nombre ?? "Producto"}${i.molienda && i.molienda !== "Única" ? ` (${i.molienda})` : ""}`).join(", ")
    : p.nombre ?? "—";

export default function PaginaLogistica() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [elegidoId, setElegidoId] = useState<number | null>(null);
  const [filtro, setFiltro] = useState<Estado | "todos">("todos");
  const [repartidor, setRepartidor] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from("pedidos")
      .select("*, pedido_items(cantidad, molienda, productos(nombre))")
      .in("canal", ["web", "subasta"])
      .order("creado_en", { ascending: false })
      .limit(200);
    setPedidos(((data as unknown as Pedido[]) ?? []).map((p) => ({ ...p, total: Number(p.total) })));
    setCargando(false);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(cargar, 0);
    const canal = supabase
      .channel("logistica")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => cargar())
      .subscribe();
    return () => {
      window.clearTimeout(t);
      supabase.removeChannel(canal);
    };
  }, [cargar]);

  const elegido = pedidos.find((p) => p.id === elegidoId) ?? pedidos[0] ?? null;
  const lista = pedidos.filter((p) => filtro === "todos" || p.estado === filtro);

  const cambiarEstado = async (p: Pedido, estado: Estado) => {
    setGuardando(true);
    const cambios: Partial<Pedido> = { estado };
    if (estado === "en_camino" && repartidor.trim()) cambios.repartidor = repartidor.trim();
    setPedidos((ps) => ps.map((x) => (x.id === p.id ? { ...x, ...cambios } : x)));
    await supabase.from("pedidos").update(cambios).eq("id", p.id);
    setRepartidor("");
    setGuardando(false);
  };

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
            onClick={() => setFiltro(filtro === e ? "todos" : e)}
          >
            <span className="dato__label">{NOMBRE[e]}</span>
            <strong className="dato__valor">{pedidos.filter((p) => p.estado === e).length}</strong>
          </button>
        ))}
      </div>

      {cargando ? (
        <p className="caja__vacia" aria-busy="true">Cargando pedidos…</p>
      ) : (
        <div className="logistica">
          <ul className="pedidos" aria-label={filtro === "todos" ? "Todos los pedidos" : `Pedidos: ${NOMBRE[filtro]}`}>
            {lista.length === 0 && <li className="caja__vacia">No hay pedidos {filtro === "todos" ? "todavía" : "en este estado"}.</li>}
            {lista.map((p) => (
              <li key={p.id}>
                <button type="button" className={`pedido${p.id === elegido?.id ? " is-on" : ""}`} onClick={() => setElegidoId(p.id)}>
                  <span className="pedido__fila">
                    <strong>{p.codigo}</strong>
                    <span className={`estado ${CLASE[p.estado]}`}>{NOMBRE[p.estado]}</span>
                  </span>
                  <span className="pedido__cliente">{p.canal === "subasta" ? "Subasta ganada" : p.nombre ?? "Cliente"}</span>
                  <span className="pedido__fila pedido__meta">
                    <span>{p.direccion ?? "Sin dirección"}</span>
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
                    <h2>{elegido.codigo}</h2>
                    <p className="caja__sub">
                      {elegido.canal === "subasta" ? elegido.nombre : elegido.nombre ?? "Cliente"} ·{" "}
                      {new Date(elegido.creado_en).toLocaleString("es-BO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}
                    </p>
                  </div>
                  <span className={`estado ${CLASE[elegido.estado]}`}>{NOMBRE[elegido.estado]}</span>
                </div>

                <ol className="avance">
                  {ESTADOS.map((e, i) => (
                    <li key={e} className={i <= ESTADOS.indexOf(elegido.estado) ? "is-on" : ""}>
                      <span className="avance__punto" aria-hidden="true" />
                      {NOMBRE[e]}
                    </li>
                  ))}
                </ol>

                <dl className="panel__datos panel__datos--3">
                  <div><dt>Productos</dt><dd>{productosDe(elegido)}</dd></div>
                  <div><dt>Dirección</dt><dd>{elegido.direccion ?? "—"}{elegido.referencia ? ` (${elegido.referencia})` : ""}</dd></div>
                  <div><dt>Teléfono</dt><dd>{elegido.telefono ?? "—"}</dd></div>
                  <div><dt>Pago</dt><dd>{elegido.metodo_pago === "qr" ? "QR" : elegido.metodo_pago === "tarjeta" ? "Tarjeta" : elegido.metodo_pago} · {formatBs(elegido.total)}</dd></div>
                  <div><dt>Repartidor</dt><dd>{elegido.repartidor || "Sin asignar"}</dd></div>
                </dl>

                {elegido.estado === "preparacion" && (
                  <div className="carrito__campo" style={{ maxWidth: 360, marginBottom: 16 }}>
                    <label htmlFor="repartidor">Repartidor (opcional)</label>
                    <input id="repartidor" value={repartidor} onChange={(e) => setRepartidor(e.target.value)} placeholder="Carlos M." />
                  </div>
                )}

                {elegido.estado === "entregado" ? (
                  <p className="caja__comprobante"><strong>Pedido entregado</strong></p>
                ) : elegido.estado === "cancelado" ? (
                  <p className="caja__comprobante"><strong>Pedido cancelado</strong></p>
                ) : (
                  <div className="equipo__fila">
                    <button type="button" className="btn btn--primary detalle__boton" disabled={guardando} onClick={() => cambiarEstado(elegido, ESTADOS[ESTADOS.indexOf(elegido.estado) + 1])}>
                      Pasar a “{NOMBRE[ESTADOS[ESTADOS.indexOf(elegido.estado) + 1]]}”
                    </button>
                    {elegido.estado === "recibido" && (
                      <button type="button" className="btn btn--secondary" disabled={guardando} onClick={() => window.confirm(`¿Cancelar el pedido ${elegido.codigo}?`) && cambiarEstado(elegido, "cancelado")}>
                        Cancelar pedido
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="caja__vacia">Cuando lleguen pedidos de la tienda aparecerán aquí.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
