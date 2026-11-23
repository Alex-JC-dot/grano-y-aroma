"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { mensajeDeError, supabase } from "@/lib/supabase";
import { formatBs } from "@/lib/utils";
import { ConfirmarPagoQr, QrPago, TEXTO_PAGO, type PagoEstado } from "./PagoPedido";
import PruebaEntrega from "./PruebaEntrega";

/**
 * Mis pedidos (Mi cuenta): cada pedido con su línea de tiempo, el estado del pago y, si
 * corresponde, el QR y el botón “Ya pagué” (el pago se confirma automáticamente). Mientras esté "Recibido" el cliente
 * puede cancelarlo (el stock vuelve a la tienda). Los cambios llegan en vivo (Realtime).
 *
 * Cuando el pedido se entrega, el cliente ve la prueba: la foto que tomó el repartidor, quién
 * recibió y a qué hora. Eso cierra el círculo del seguimiento: el estado "Entregado" deja de
 * ser una palabra y pasa a ser algo que se puede comprobar.
 */

type Estado = "recibido" | "preparacion" | "en_camino" | "entregado" | "cancelado";
type Pedido = {
  id: number;
  codigo: string;
  canal: string;
  estado: Estado;
  total: number;
  nombre: string | null;
  direccion: string | null;
  metodo_pago: string;
  pago_estado: PagoEstado;
  pago_nota: string | null;
  repartidor: string | null;
  entrega_foto: string | null;
  entrega_recibido_por: string | null;
  entrega_tipo: string | null;
  entrega_nota: string | null;
  entrega_firma: string | null;
  preparado_por: string | null;
  reparto: { nombre: string; telefono: string | null; vehiculo: string | null } | null;
  creado_en: string;
  preparacion_en: string | null;
  en_camino_en: string | null;
  entregado_en: string | null;
  cancelado_en: string | null;
  pedido_items: { cantidad: number; molienda: string | null; productos: { nombre: string } | null }[];
};

const ESTADO: Record<Estado, string> = {
  recibido: "Recibido",
  preparacion: "En preparación",
  en_camino: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
};
const PASOS: { e: Estado; hora: keyof Pedido; texto: string }[] = [
  { e: "recibido", hora: "creado_en", texto: "Recibimos tu pedido" },
  { e: "preparacion", hora: "preparacion_en", texto: "Lo estamos preparando" },
  { e: "en_camino", hora: "en_camino_en", texto: "Va en camino" },
  { e: "entregado", hora: "entregado_en", texto: "Entregado" },
];

const hora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-BO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }) : "";

const productosDe = (p: Pedido) =>
  p.canal === "subasta" && !p.pedido_items.length
    ? p.nombre ?? "Lote ganado en subasta"
    : p.pedido_items.map((i) => `${i.cantidad} × ${i.productos?.nombre ?? "Producto"}${i.molienda && i.molienda !== "Única" ? ` (${i.molienda})` : ""}`).join(", ");

export default function MisPedidos({ uid }: { uid: string }) {
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [abierto, setAbierto] = useState<number | null>(null);
  const [cancelando, setCancelando] = useState<number | null>(null);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from("pedidos")
      .select("id, codigo, canal, estado, total, nombre, direccion, metodo_pago, pago_estado, pago_nota, repartidor, preparado_por, entrega_foto, entrega_recibido_por, entrega_tipo, entrega_nota, entrega_firma, creado_en, preparacion_en, en_camino_en, entregado_en, cancelado_en, pedido_items(cantidad, molienda, productos(nombre)), reparto:repartidores!pedidos_repartidor_id_fkey(nombre, telefono, vehiculo)")
      .eq("cliente_id", uid)
      .order("creado_en", { ascending: false });
    setPedidos(((data as unknown as Pedido[]) ?? []).map((p) => ({ ...p, total: Number(p.total) })));
  }, [uid]);

  useEffect(() => {
    const t = window.setTimeout(cargar, 0);
    // Cuando el equipo cambia el estado o revisa el pago, se ve aquí sin recargar.
    const canal = supabase
      .channel(`mis-pedidos-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos", filter: `cliente_id=eq.${uid}` }, () => cargar())
      .subscribe();
    return () => {
      window.clearTimeout(t);
      supabase.removeChannel(canal);
    };
  }, [cargar, uid]);

  const cancelar = async (p: Pedido) => {
    if (!window.confirm(`¿Cancelar el pedido ${p.codigo}? Si ya pagaste, te devolvemos el dinero por el mismo medio.`)) return;
    setError("");
    setCancelando(p.id);
    const { error } = await supabase.rpc("cancelar_pedido", { p_pedido: p.id });
    setCancelando(null);
    if (error) return setError(mensajeDeError(error));
    cargar();
  };

  if (pedidos === null) return <p aria-busy="true">Cargando pedidos…</p>;
  if (pedidos.length === 0)
    return (
      <p className="filtros__vacio">
        Todavía no hiciste pedidos. <Link href="/tienda" className="link">Ver la tienda</Link>
      </p>
    );

  return (
    <ul className="mis-pedidos">
      {error && <li className="carrito__error" role="alert">{error}</li>}
      {pedidos.map((p) => {
        const ver = abierto === p.id;
        const actual = PASOS.findIndex((x) => x.e === p.estado);
        const esperaPago = p.pago_estado === "pendiente" || p.pago_estado === "por_verificar" || p.pago_estado === "rechazado";
        return (
          <li key={p.id} className={`mi-pedido${ver ? " is-abierto" : ""}`}>
            <button type="button" className="mi-pedido__cabeza" aria-expanded={ver} onClick={() => setAbierto(ver ? null : p.id)}>
              <span className="mi-pedido__codigo">
                <strong>{p.codigo}</strong>
                <small>{new Date(p.creado_en).toLocaleDateString("es-BO", { day: "numeric", month: "long", year: "numeric" })}</small>
              </span>
              <span className="mi-pedido__productos">{productosDe(p)}</span>
              <span className="mi-pedido__estados">
                <span className={`estado${p.estado === "cancelado" ? " estado--cancelada" : p.estado === "entregado" ? "" : " estado--recibido"}`}>{ESTADO[p.estado]}</span>
                {p.pago_estado !== "no_aplica" && p.pago_estado !== "aprobado" && p.estado !== "cancelado" && (
                  <span className={`estado ${p.pago_estado === "rechazado" ? "estado--cancelada" : "estado--camino"}`}>{TEXTO_PAGO[p.pago_estado]}</span>
                )}
              </span>
              <span className="mi-pedido__total">{formatBs(p.total)}</span>
            </button>

            {ver && (
              <div className="mi-pedido__detalle">
                {p.estado === "cancelado" ? (
                  <p className="caja__sub">Cancelado el {hora(p.cancelado_en)}.</p>
                ) : (
                  <ol className="linea-tiempo">
                    {PASOS.map((x, i) => (
                      <li key={x.e} className={i <= actual ? "is-on" : ""}>
                        <span className="linea-tiempo__punto" aria-hidden="true" />
                        <span>
                          <strong>{x.texto}</strong>
                          {i <= actual && <small>{hora(p[x.hora] as string | null)}</small>}
                          {x.e === "en_camino" && i <= actual && (p.reparto?.nombre || p.repartidor) && (
                          <small>
                            Lo lleva {p.reparto?.nombre ?? p.repartidor}
                            {p.reparto?.vehiculo ? ` · ${p.reparto.vehiculo}` : ""}
                          </small>
                        )}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}

                {p.estado === "entregado" && (
                  <PruebaEntrega
                    foto={p.entrega_foto}
                    recibidoPor={p.entrega_recibido_por}
                    tipo={p.entrega_tipo}
                    nota={p.entrega_nota}
                    firma={p.entrega_firma}
                    cuando={p.entregado_en}
                    repartidor={p.reparto?.nombre ?? p.repartidor}
                  />
                )}

                {p.estado !== "cancelado" && p.metodo_pago === "qr" && p.pago_estado !== "no_aplica" && (
                  <div className="mi-pedido__pago">
                    <h3>Pago por QR · {TEXTO_PAGO[p.pago_estado]}</h3>
                    {esperaPago && <QrPago codigo={p.codigo} total={p.total} />}
                    <ConfirmarPagoQr pedidoId={p.id} estado={p.pago_estado} alPagar={cargar} />
                  </div>
                )}

                <dl className="carrito__resumen">
                  {p.direccion && (<><dt>Entrega en</dt><dd>{p.direccion}</dd></>)}
                  <dt>Pago</dt><dd>{p.metodo_pago === "qr" ? "QR Bolivia" : p.metodo_pago === "tarjeta" ? "Tarjeta" : "Por definir"}</dd>
                  <dt>Total</dt><dd>{formatBs(p.total)}</dd>
                </dl>

                {p.estado === "recibido" && p.canal === "web" && (
                  <button type="button" className="link mi-pedido__cancelar" disabled={cancelando === p.id} onClick={() => cancelar(p)}>
                    {cancelando === p.id ? "Cancelando…" : "Cancelar pedido"}
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
