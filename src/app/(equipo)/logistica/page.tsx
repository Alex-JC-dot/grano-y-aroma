"use client";

import { useCallback, useEffect, useState } from "react";
import { mensajeDeError, supabase } from "@/lib/supabase";
import { formatBs } from "@/lib/utils";
import { verComprobante } from "@/lib/archivos";
import { TEXTO_PAGO, type PagoEstado } from "@/components/cuenta/PagoPedido";

/**
 * Logística (RF-29 a RF-31): pedidos de la tienda en línea y de subastas desde Supabase, por
 * estado. Al pasar un pedido al siguiente estado, el cliente lo ve en "Mi cuenta". Realtime
 * trae los pedidos nuevos sin recargar.
 *
 * Pagos por QR: el pedido no puede pasar a preparación hasta que el equipo abre el
 * comprobante y lo aprueba (la base también lo impide). Si lo rechaza, escribe el motivo y el
 * cliente puede enviar otro desde Mi cuenta.
 *
 * El botón de WhatsApp abre un chat con el cliente con un mensaje ya escrito según el estado.
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
  pago_estado: PagoEstado;
  pago_nota: string | null;
  comprobante: string | null;
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

/** El pedido puede pasar de "Recibido" a preparación solo con el pago resuelto. */
const pagoListo = (p: Pedido) => !p.pago_estado || p.pago_estado === "aprobado" || p.pago_estado === "no_aplica";

/** Enlace de WhatsApp con un mensaje según el estado. Números de 8 dígitos se toman como Bolivia. */
function enlaceWhatsapp(p: Pedido): string | null {
  const digitos = (p.telefono ?? "").replace(/\D/g, "");
  if (digitos.length < 8) return null;
  const numero = digitos.length === 8 ? `591${digitos}` : digitos;
  const hola = `Hola${p.nombre ? ` ${p.nombre.split(" ")[0]}` : ""}, te escribimos de Grano y Aroma sobre tu pedido ${p.codigo}.`;
  const cuerpo =
    p.pago_estado === "rechazado"
      ? `No pudimos validar tu comprobante${p.pago_nota ? ` (${p.pago_nota})` : ""}. ¿Nos envías otro desde Mi cuenta?`
      : p.pago_estado === "pendiente"
        ? "Todavía no recibimos tu comprobante de pago. Puedes subirlo desde Mi cuenta."
        : p.estado === "recibido"
          ? "Ya lo recibimos y pronto empezamos a prepararlo."
          : p.estado === "preparacion"
            ? "Lo estamos preparando y hoy sale a entrega."
            : p.estado === "en_camino"
              ? `Ya va en camino${p.repartidor ? ` con ${p.repartidor}` : ""}. ¡Que lo disfrutes!`
              : p.estado === "entregado"
                ? "Gracias por tu compra. ¡Esperamos que disfrutes tu café!"
                : "Tu pedido fue cancelado.";
  return `https://wa.me/${numero}?text=${encodeURIComponent(`${hola} ${cuerpo}`)}`;
}

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
  const [error, setError] = useState("");
  const [nota, setNota] = useState("");
  const [rechazando, setRechazando] = useState(false);

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
    setError("");
    const cambios: Partial<Pedido> = { estado };
    if (estado === "en_camino" && repartidor.trim()) cambios.repartidor = repartidor.trim();
    const { error } = await supabase.from("pedidos").update(cambios).eq("id", p.id);
    setGuardando(false);
    if (error) return setError(mensajeDeError(error));
    setPedidos((ps) => ps.map((x) => (x.id === p.id ? { ...x, ...cambios } : x)));
    setRepartidor("");
  };

  // Cancelar pasa por la base para devolver el stock y los puntos.
  const cancelar = async (p: Pedido) => {
    if (!window.confirm(`¿Cancelar el pedido ${p.codigo}? El stock vuelve a la tienda.`)) return;
    setGuardando(true);
    setError("");
    const { error } = await supabase.rpc("cancelar_pedido", { p_pedido: p.id });
    setGuardando(false);
    if (error) return setError(mensajeDeError(error));
    cargar();
  };

  const abrirComprobante = async (p: Pedido) => {
    if (!p.comprobante) return;
    // La pestaña se abre antes de pedir el enlace para que el navegador no la bloquee.
    const ventana = window.open("", "_blank");
    const url = await verComprobante(p.comprobante);
    if (url && ventana) ventana.location.href = url;
    else {
      ventana?.close();
      setError("No se pudo abrir el comprobante.");
    }
  };

  const revisarPago = async (p: Pedido, aprobado: boolean) => {
    if (!aprobado && !nota.trim()) return setError("Escribe por qué rechazas el comprobante: el cliente lo verá.");
    setGuardando(true);
    setError("");
    const { error } = await supabase.rpc("verificar_pago", { p_pedido: p.id, p_aprobado: aprobado, p_nota: aprobado ? null : nota.trim() });
    setGuardando(false);
    if (error) return setError(mensajeDeError(error));
    setNota("");
    setRechazando(false);
    cargar();
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
                <button type="button" className={`pedido${p.id === elegido?.id ? " is-on" : ""}`} onClick={() => { setElegidoId(p.id); setError(""); setNota(""); setRechazando(false); }}>
                  <span className="pedido__fila">
                    <strong>{p.codigo}</strong>
                    <span className={`estado ${CLASE[p.estado]}`}>{NOMBRE[p.estado]}</span>
                  </span>
                  {p.estado === "recibido" && !pagoListo(p) && (
                    <span className={`estado ${p.pago_estado === "por_verificar" ? "estado--camino" : "estado--pausada"} pedido__pago`}>
                      {p.pago_estado === "por_verificar" ? "Revisar comprobante" : TEXTO_PAGO[p.pago_estado]}
                    </span>
                  )}
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
                  <div>
                    <dt>Pago</dt>
                    <dd>
                      {elegido.metodo_pago === "qr" ? "QR" : elegido.metodo_pago === "tarjeta" ? "Tarjeta" : elegido.metodo_pago} · {formatBs(elegido.total)}
                      {elegido.pago_estado && elegido.pago_estado !== "no_aplica" && <small>{TEXTO_PAGO[elegido.pago_estado]}</small>}
                    </dd>
                  </div>
                  <div><dt>Repartidor</dt><dd>{elegido.repartidor || "Sin asignar"}</dd></div>
                </dl>

                {/* Revisión del comprobante de pago por QR */}
                {elegido.estado !== "cancelado" && elegido.metodo_pago === "qr" && !pagoListo(elegido) && (
                  <div className="revision-pago">
                    {elegido.pago_estado === "por_verificar" ? (
                      <>
                        <p><strong>El cliente envió su comprobante.</strong> Revísalo y confirma que el monto sea {formatBs(elegido.total)}.</p>
                        <div className="equipo__fila">
                          <button type="button" className="btn btn--secondary" onClick={() => abrirComprobante(elegido)}>Ver comprobante</button>
                          <button type="button" className="btn btn--primary" disabled={guardando} onClick={() => revisarPago(elegido, true)}>Aprobar pago</button>
                          <button type="button" className="link" disabled={guardando} onClick={() => setRechazando((x) => !x)}>Rechazar</button>
                        </div>
                        {rechazando && (
                          <div className="carrito__campo revision-pago__nota">
                            <label htmlFor="nota-rechazo">Motivo (el cliente lo verá)</label>
                            <input id="nota-rechazo" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="El monto no coincide, la imagen no se lee…" />
                            <button type="button" className="btn btn--secondary" disabled={guardando} onClick={() => revisarPago(elegido, false)}>Rechazar comprobante</button>
                          </div>
                        )}
                      </>
                    ) : (
                      <p>
                        <strong>{TEXTO_PAGO[elegido.pago_estado]}.</strong>{" "}
                        {elegido.pago_estado === "rechazado"
                          ? `Motivo: ${elegido.pago_nota ?? "—"}. Esperando que el cliente envíe otro.`
                          : "El cliente todavía no envió su comprobante. Puedes recordárselo por WhatsApp."}
                      </p>
                    )}
                  </div>
                )}

                {elegido.estado === "preparacion" && (
                  <div className="carrito__campo" style={{ maxWidth: 360, marginBottom: 16 }}>
                    <label htmlFor="repartidor">Repartidor (opcional)</label>
                    <input id="repartidor" value={repartidor} onChange={(e) => setRepartidor(e.target.value)} placeholder="Carlos M." />
                  </div>
                )}

                {error && <p className="carrito__error" role="alert">{error}</p>}

                {elegido.estado === "entregado" ? (
                  <p className="caja__comprobante"><strong>Pedido entregado</strong></p>
                ) : elegido.estado === "cancelado" ? (
                  <p className="caja__comprobante"><strong>Pedido cancelado</strong></p>
                ) : (
                  <div className="equipo__fila">
                    <button
                      type="button"
                      className="btn btn--primary detalle__boton"
                      disabled={guardando || (elegido.estado === "recibido" && !pagoListo(elegido))}
                      title={elegido.estado === "recibido" && !pagoListo(elegido) ? "Primero aprueba el pago" : undefined}
                      onClick={() => cambiarEstado(elegido, ESTADOS[ESTADOS.indexOf(elegido.estado) + 1])}
                    >
                      Pasar a “{NOMBRE[ESTADOS[ESTADOS.indexOf(elegido.estado) + 1]]}”
                    </button>
                    {elegido.estado === "recibido" && (
                      <button type="button" className="btn btn--secondary" disabled={guardando} onClick={() => cancelar(elegido)}>
                        Cancelar pedido
                      </button>
                    )}
                  </div>
                )}

                {enlaceWhatsapp(elegido) && (
                  <a className="btn btn--secondary logistica__whatsapp" href={enlaceWhatsapp(elegido)!} target="_blank" rel="noreferrer">
                    Avisar por WhatsApp
                  </a>
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
