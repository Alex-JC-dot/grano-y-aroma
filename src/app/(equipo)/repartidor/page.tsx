"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatBs } from "@/lib/utils";
import { useAuth } from "@/store/authStore";
import DialogoEntrega from "@/components/equipo/DialogoEntrega";

/**
 * Mis entregas (rol repartidor, migración 012): el repartidor ve SOLO los pedidos que le
 * asignaron al despachar. Desde aquí llega a la dirección, llama o escribe al cliente y, al
 * dejar el pedido, confirma la entrega con foto, nombre de quien recibió y firma.
 *
 * Solo él puede confirmarla (la base lo exige). Después el admin revisa la prueba en
 * Logística y la finaliza, o la devuelve con un motivo que aparece aquí para corregirla.
 * Pensada para el celular: una columna, botones grandes y nada que no sirva en la calle.
 */

type Ficha = { id: number; nombre: string; telefono: string | null; vehiculo: string | null };
type Pedido = {
  id: number;
  codigo: string;
  estado: "en_camino" | "entregado" | "recibido" | "preparacion" | "cancelado";
  total: number;
  nombre: string | null;
  telefono: string | null;
  direccion: string | null;
  referencia: string | null;
  metodo_pago: string;
  pago_estado: string | null;
  cliente_id: string | null;
  en_camino_en: string | null;
  entregado_en: string | null;
  entrega_recibido_por: string | null;
  entrega_verificada_en: string | null;
  entrega_observacion: string | null;
  pedido_items: { cantidad: number; molienda: string | null; productos: { nombre: string } | null }[];
};

const hora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-BO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }) : "";

const productosDe = (p: Pedido) =>
  p.pedido_items.length
    ? p.pedido_items.map((i) => `${i.cantidad} × ${i.productos?.nombre ?? "Producto"}${i.molienda && i.molienda !== "Única" ? ` (${i.molienda})` : ""}`).join(", ")
    : "Lote ganado en subasta";

/** Teléfono para enlaces: 8 dígitos se toman como celular de Bolivia. */
const numero = (tel: string | null) => {
  const d = (tel ?? "").replace(/\D/g, "");
  return d.length < 8 ? null : d.length === 8 ? `591${d}` : d;
};

const esHoy = (iso: string | null) => !!iso && new Date(iso).toDateString() === new Date().toDateString();

export default function MisEntregas() {
  const uid = useAuth((s) => s.session?.user.id);
  const [ficha, setFicha] = useState<Ficha | null | undefined>(undefined);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [entregando, setEntregando] = useState<Pedido | null>(null);

  const cargar = useCallback(async () => {
    if (!uid) return;
    const { data: f } = await supabase.from("repartidores").select("id, nombre, telefono, vehiculo").eq("perfil_id", uid).maybeSingle();
    setFicha((f as Ficha) ?? null);
    if (!f) return;
    // La base ya filtra por repartidor (RLS); el filtro aquí es solo para ser explícitos.
    const { data } = await supabase
      .from("pedidos")
      .select(
        "id, codigo, estado, total, nombre, telefono, direccion, referencia, metodo_pago, pago_estado, cliente_id, en_camino_en, entregado_en, entrega_recibido_por, entrega_verificada_en, entrega_observacion, pedido_items(cantidad, molienda, productos(nombre))",
      )
      .eq("repartidor_id", (f as Ficha).id)
      .in("estado", ["en_camino", "entregado"])
      .order("en_camino_en", { ascending: false })
      .limit(60);
    setPedidos(((data as unknown as Pedido[]) ?? []).map((p) => ({ ...p, total: Number(p.total) })));
  }, [uid]);

  useEffect(() => {
    const t = window.setTimeout(cargar, 0);
    // Un pedido nuevo despachado o una entrega devuelta por el admin llegan sin recargar.
    const canal = supabase
      .channel(`mis-entregas-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => cargar())
      .subscribe();
    return () => {
      window.clearTimeout(t);
      supabase.removeChannel(canal);
    };
  }, [cargar, uid]);

  const porEntregar = pedidos.filter((p) => p.estado === "en_camino");
  const entregados = pedidos.filter((p) => p.estado === "entregado");

  return (
    <div className="equipo__pagina reparto">
      <div className="equipo__cabeza reparto__cabeza">
        <span className="reparto__icono" aria-hidden="true" />
        <div>
          <p className="eyebrow">Reparto</p>
          <h1>Mis entregas</h1>
          {ficha && (
            <p className="caja__sub">
              {ficha.nombre}
              {ficha.vehiculo ? ` · ${ficha.vehiculo}` : ""}
            </p>
          )}
        </div>
      </div>

      {ficha === undefined ? (
        <p className="caja__vacia" aria-busy="true">Cargando tus entregas…</p>
      ) : ficha === null ? (
        <div className="caja__vacia reparto__vacio">
          <span className="reparto__ilustracion" aria-hidden="true" />
          <p><strong>Tu cuenta todavía no está unida a un repartidor.</strong></p>
          <p>Pídele al administrador que te asigne el rol Repartidor en Usuarios.</p>
        </div>
      ) : (
        <>
          <div className="tarjetas-dato">
            <div className="dato">
              <span className="dato__label">Por entregar</span>
              <strong className="dato__valor">{porEntregar.length}</strong>
            </div>
            <div className="dato">
              <span className="dato__label">Entregados hoy</span>
              <strong className="dato__valor">{entregados.filter((p) => esHoy(p.entregado_en)).length}</strong>
            </div>
            <div className="dato">
              <span className="dato__label">En revisión</span>
              <strong className="dato__valor">{entregados.filter((p) => !p.entrega_verificada_en).length}</strong>
              <span className="dato__nota">El admin revisa tu prueba</span>
            </div>
          </div>

          <h2 className="reparto__titulo">Por entregar</h2>
          {porEntregar.length === 0 ? (
            <div className="caja__vacia reparto__vacio">
              <span className="reparto__ilustracion" aria-hidden="true" />
              <p>No tienes pedidos por entregar. Cuando te despachen uno, aparece aquí.</p>
            </div>
          ) : (
            <ul className="reparto__lista">
              {porEntregar.map((p) => {
                const tel = numero(p.telefono);
                const direccion = [p.direccion, p.referencia].filter(Boolean).join(" · ");
                return (
                  <li key={p.id} className="reparto-pedido">
                    <div className="reparto-pedido__cabeza">
                      <strong>{p.codigo}</strong>
                      <span className="estado estado--camino">En camino</span>
                    </div>
                    {p.entrega_observacion && (
                      <p className="pago-aviso pago-aviso--rechazo" role="alert">
                        <strong>El administrador pidió corregir la entrega:</strong> {p.entrega_observacion}
                      </p>
                    )}
                    <dl className="reparto-pedido__datos">
                      <div><dt>Cliente</dt><dd>{p.nombre ?? "Cliente"}</dd></div>
                      <div><dt>Dirección</dt><dd>{direccion || "Sin dirección"}</dd></div>
                      <div><dt>Lleva</dt><dd>{productosDe(p)}</dd></div>
                      <div>
                        <dt>Pago</dt>
                        <dd>
                          {formatBs(p.total)}{" "}
                          {p.pago_estado === "aprobado" ? <small>· Ya está pagado, no cobres nada</small> : <small>· Consulta con el equipo</small>}
                        </dd>
                      </div>
                      <div><dt>Salió</dt><dd>{hora(p.en_camino_en)}</dd></div>
                    </dl>
                    <div className="reparto-pedido__acciones">
                      {p.direccion && (
                        <a className="btn btn--secondary" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.direccion}, Sucre, Bolivia`)}`} target="_blank" rel="noreferrer">
                          Cómo llegar
                        </a>
                      )}
                      {tel && <a className="btn btn--secondary" href={`tel:+${tel}`}>Llamar</a>}
                      {tel && (
                        <a
                          className="btn btn--secondary"
                          href={`https://wa.me/${tel}?text=${encodeURIComponent(`Hola${p.nombre ? ` ${p.nombre.split(" ")[0]}` : ""}, soy ${ficha.nombre} de Grano y Aroma. Estoy llevando tu pedido ${p.codigo}.`)}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          WhatsApp
                        </a>
                      )}
                    </div>
                    <button type="button" className="btn btn--primary reparto-pedido__entregar" onClick={() => setEntregando(p)}>
                      Confirmar entrega
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {entregados.length > 0 && (
            <>
              <h2 className="reparto__titulo">Entregados</h2>
              <ul className="reparto__hechos">
                {entregados.map((p) => (
                  <li key={p.id}>
                    <span>
                      <strong>{p.codigo}</strong>
                      <small>{p.nombre ?? "Cliente"} · recibió {p.entrega_recibido_por ?? "—"} · {hora(p.entregado_en)}</small>
                    </span>
                    <span className={`estado${p.entrega_verificada_en ? "" : " estado--camino"}`}>
                      {p.entrega_verificada_en ? "Finalizada" : "En revisión"}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {entregando && (
        <DialogoEntrega
          pedidoId={entregando.id}
          codigo={entregando.codigo}
          clienteId={entregando.cliente_id}
          nombreCliente={entregando.nombre}
          alTerminar={cargar}
          alCerrar={() => setEntregando(null)}
        />
      )}
    </div>
  );
}
