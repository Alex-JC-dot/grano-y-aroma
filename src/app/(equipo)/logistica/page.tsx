"use client";

import { useCallback, useEffect, useState } from "react";
import { mensajeDeError, supabase } from "@/lib/supabase";
import { formatBs } from "@/lib/utils";
import { TEXTO_PAGO, type PagoEstado } from "@/components/cuenta/PagoPedido";
import DialogoEntrega from "@/components/equipo/DialogoEntrega";
import DialogoEtapa from "@/components/equipo/DialogoEtapa";
import VisorArchivo from "@/components/equipo/VisorArchivo";

/**
 * Logística (RF-29 a RF-31): pedidos de la tienda en línea y de subastas desde Supabase, por
 * estado. Al pasar un pedido al siguiente estado, el cliente lo ve en "Mi cuenta". Realtime
 * trae los pedidos nuevos sin recargar.
 *
 * Pagos por QR: el pedido no puede pasar a preparación hasta que el equipo abre el
 * comprobante y lo aprueba (la base también lo impide). Si lo rechaza, escribe el motivo y el
 * cliente puede enviar otro desde Mi cuenta.
 *
 * Cada etapa deja constancia de quién la hizo (migración 011): quién preparó el pedido, qué
 * repartidor lo lleva y quién registró la entrega, con foto, nombre de quien recibió y firma.
 * Ninguna se puede saltar ni cerrar sin su evidencia, porque la regla vive en la base: los
 * botones abren un diálogo, no cambian el estado por sí solos.
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
  pago_nombre: { nombre: string } | null;   // quién revisó el pago (FK a perfiles)
  pago_revisado_en: string | null;
  comprobante: string | null;
  cliente_id: string | null;
  entrega_foto: string | null;
  entrega_recibido_por: string | null;
  entrega_tipo: string | null;
  entrega_nota: string | null;
  entrega_firma: string | null;
  entregado_en: string | null;
  preparacion_en: string | null;
  en_camino_en: string | null;
  preparado_nota: string | null;
  preparo: { nombre: string } | null;        // FK preparado_por → perfiles
  despacho: { nombre: string } | null;       // FK despachado_por → perfiles
  entrego: { nombre: string } | null;        // FK entrega_registrada_por → perfiles
  reparto: { nombre: string; telefono: string | null; vehiculo: string | null } | null;
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

/** En qué calidad recibió el pedido (los valores los valida la base en la 010). */
const CALIDAD: Record<string, string> = {
  titular: "La persona que pidió",
  familiar: "Un familiar",
  portero: "Portería o recepción",
  vecino: "Un vecino",
  otro: "Otra persona",
};

const fechaHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-BO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }) : "—";

const productosDe = (p: Pedido) =>
  p.pedido_items.length
    ? p.pedido_items.map((i) => `${i.cantidad} × ${i.productos?.nombre ?? "Producto"}${i.molienda && i.molienda !== "Única" ? ` (${i.molienda})` : ""}`).join(", ")
    : p.nombre ?? "—";

export default function PaginaLogistica() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [elegidoId, setElegidoId] = useState<number | null>(null);
  const [filtro, setFiltro] = useState<Estado | "todos">("todos");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [nota, setNota] = useState("");
  const [rechazando, setRechazando] = useState(false);
  const [etapa, setEtapa] = useState<"preparacion" | "despacho" | "entrega" | null>(null);
  const [viendo, setViendo] = useState<{ bucket: "comprobantes" | "entregas"; ruta: string; titulo: string } | null>(null);

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from("pedidos")
      // pago_nombre llega por la clave foránea pago_revisado_por → perfiles (migración 010).
      .select(
        "*, pedido_items(cantidad, molienda, productos(nombre))," +
          "pago_nombre:perfiles!pedidos_pago_revisado_por_fkey(nombre)," +
          "preparo:perfiles!pedidos_preparado_por_fkey(nombre)," +
          "despacho:perfiles!pedidos_despachado_por_fkey(nombre)," +
          "entrego:perfiles!pedidos_entrega_registrada_por_fkey(nombre)," +
          "reparto:repartidores!pedidos_repartidor_id_fkey(nombre, telefono, vehiculo)",
      )
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

  /*
   * Ya no hay un "cambiar estado" genérico. Cada avance pasa por su diálogo, que recoge la
   * evidencia y llama a la función correspondiente de la base. Un UPDATE suelto sobre el
   * estado lo rechazan los triggers de las migraciones 010 y 011.
   */
  const siguienteEtapa = (p: Pedido): "preparacion" | "despacho" | "entrega" | null =>
    p.estado === "recibido" ? "preparacion" : p.estado === "preparacion" ? "despacho" : p.estado === "en_camino" ? "entrega" : null;

  const TEXTO_ETAPA = {
    preparacion: "Empezar a preparar…",
    despacho: "Despachar…",
    entrega: "Confirmar entrega…",
  } as const;

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

  // El comprobante y la foto de entrega se ven dentro de la página, junto a los datos del
  // pedido: revisar un pago comparando el monto de memoria en otra pestaña es cómo se cuelan
  // los errores.
  const verArchivo = (bucket: "comprobantes" | "entregas", ruta: string | null, titulo: string) => {
    if (!ruta) return;
    setViendo({ bucket, ruta, titulo });
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

                {/*
                  La línea de avance ya no es solo el nombre del estado: cada paso cumplido
                  muestra su hora y quién lo hizo. Es lo que convierte "En preparación" en
                  información útil para quien atiende un reclamo.
                */}
                <ol className="avance avance--detalle">
                  {ESTADOS.map((e, i) => {
                    const hecho = i <= ESTADOS.indexOf(elegido.estado);
                    const cuando =
                      e === "recibido" ? elegido.creado_en
                      : e === "preparacion" ? elegido.preparacion_en
                      : e === "en_camino" ? elegido.en_camino_en
                      : elegido.entregado_en;
                    const quien =
                      e === "preparacion" ? elegido.preparo?.nombre
                      : e === "en_camino" ? elegido.reparto?.nombre
                      : e === "entregado" ? elegido.entrega_recibido_por
                      : null;
                    const etiqueta = e === "en_camino" ? "Lleva" : e === "entregado" ? "Recibió" : "Preparó";
                    return (
                      <li key={e} className={hecho ? "is-on" : ""}>
                        <span className="avance__punto" aria-hidden="true" />
                        <span className="avance__texto">
                          <strong>{NOMBRE[e]}</strong>
                          {hecho && cuando && <small>{fechaHora(cuando)}</small>}
                          {hecho && quien && <small>{etiqueta}: {quien}</small>}
                          {e === "preparacion" && hecho && elegido.preparado_nota && <small>“{elegido.preparado_nota}”</small>}
                        </span>
                      </li>
                    );
                  })}
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
                      {/* Quién revisó el comprobante: sin esto, "aprobado" no dice quién respondió por él. */}
                      {elegido.pago_revisado_en && (
                        <small>
                          {elegido.pago_estado === "rechazado" ? "Rechazado" : "Aprobado"} por {elegido.pago_nombre?.nombre ?? "el equipo"} ·{" "}
                          {new Date(elegido.pago_revisado_en).toLocaleString("es-BO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}
                        </small>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Repartidor</dt>
                    <dd>
                      {elegido.reparto?.nombre ?? elegido.repartidor ?? "Sin asignar"}
                      {elegido.reparto?.vehiculo && <small>{elegido.reparto.vehiculo}</small>}
                      {elegido.reparto?.telefono && <small>Tel. {elegido.reparto.telefono}</small>}
                      {elegido.despacho?.nombre && <small>Despachó {elegido.despacho.nombre}</small>}
                    </dd>
                  </div>
                  {elegido.preparo?.nombre && (
                    <div>
                      <dt>Preparó</dt>
                      <dd>
                        {elegido.preparo.nombre}
                        {elegido.preparado_nota && <small>“{elegido.preparado_nota}”</small>}
                      </dd>
                    </div>
                  )}
                </dl>

                {/* Revisión del comprobante de pago por QR */}
                {elegido.estado !== "cancelado" && elegido.metodo_pago === "qr" && !pagoListo(elegido) && (
                  <div className="revision-pago">
                    {elegido.pago_estado === "por_verificar" ? (
                      <>
                        <p><strong>El cliente envió su comprobante.</strong> Revísalo y confirma que el monto sea {formatBs(elegido.total)}.</p>
                        <div className="equipo__fila">
                          <button type="button" className="btn btn--secondary" onClick={() => verArchivo("comprobantes", elegido.comprobante, `Comprobante del pedido ${elegido.codigo}`)}>Ver comprobante</button>
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

                {error && <p className="carrito__error" role="alert">{error}</p>}

                {elegido.estado === "entregado" ? (
                  /* Prueba de entrega: lo que permite responder un "a mí nunca me llegó". */
                  <div className="prueba">
                    <div className="prueba__datos">
                      <p className="prueba__titulo"><strong>Entregado</strong> · {fechaHora(elegido.entregado_en)}</p>
                      <dl className="panel__datos">
                        <div><dt>Recibió</dt><dd>{elegido.entrega_recibido_por ?? "—"}{elegido.entrega_tipo ? <small>{CALIDAD[elegido.entrega_tipo] ?? elegido.entrega_tipo}</small> : null}</dd></div>
                        {elegido.reparto?.nombre && (<div><dt>Lo llevó</dt><dd>{elegido.reparto.nombre}{elegido.reparto.vehiculo ? <small>{elegido.reparto.vehiculo}</small> : null}</dd></div>)}
                        {elegido.entrego?.nombre && (<div><dt>Registró</dt><dd>{elegido.entrego.nombre}</dd></div>)}
                        {elegido.entrega_nota && (<div><dt>Nota</dt><dd>{elegido.entrega_nota}</dd></div>)}
                      </dl>
                    </div>
                    <div className="prueba__archivos">
                      {elegido.entrega_foto ? (
                        <button type="button" className="prueba__foto" onClick={() => verArchivo("entregas", elegido.entrega_foto, `Entrega del pedido ${elegido.codigo}`)}>
                          Ver la foto
                        </button>
                      ) : (
                        /* Pedidos cerrados antes de la 010: quedaron sin prueba y conviene decirlo. */
                        <p className="caja__sub">Este pedido se cerró antes de que se pidiera foto de entrega.</p>
                      )}
                      {elegido.entrega_firma && (
                        <button type="button" className="prueba__foto" onClick={() => verArchivo("entregas", elegido.entrega_firma, `Firma de ${elegido.entrega_recibido_por ?? "quien recibió"}`)}>
                          Ver la firma
                        </button>
                      )}
                    </div>
                  </div>
                ) : elegido.estado === "cancelado" ? (
                  <p className="caja__comprobante"><strong>Pedido cancelado</strong></p>
                ) : (
                  <div className="equipo__fila">
                    {(() => {
                      const paso = siguienteEtapa(elegido);
                      if (!paso) return null;
                      const faltaPago = elegido.estado === "recibido" && !pagoListo(elegido);
                      return (
                        <button
                          type="button"
                          className="btn btn--primary detalle__boton"
                          disabled={guardando || faltaPago}
                          title={faltaPago ? "Primero aprueba el pago" : undefined}
                          onClick={() => { setError(""); setEtapa(paso); }}
                        >
                          {TEXTO_ETAPA[paso]}
                        </button>
                      );
                    })()}
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

      {etapa === "entrega" && elegido && (
        <DialogoEntrega
          pedidoId={elegido.id}
          codigo={elegido.codigo}
          clienteId={elegido.cliente_id}
          nombreCliente={elegido.nombre}
          alTerminar={cargar}
          alCerrar={() => setEtapa(null)}
        />
      )}

      {(etapa === "preparacion" || etapa === "despacho") && elegido && (
        <DialogoEtapa
          etapa={etapa}
          pedidoId={elegido.id}
          codigo={elegido.codigo}
          alTerminar={cargar}
          alCerrar={() => setEtapa(null)}
        />
      )}

      {viendo && <VisorArchivo bucket={viendo.bucket} ruta={viendo.ruta} titulo={viendo.titulo} alCerrar={() => setViendo(null)} />}
    </div>
  );
}
