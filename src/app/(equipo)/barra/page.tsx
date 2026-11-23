"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mensajeDeError, supabase } from "@/lib/supabase";
import { formatBs } from "@/lib/utils";

/**
 * Barra (migración 014): la "pantalla de cocina" del barista. Muestra los pedidos que
 * llegan del tótem, ya pagados, en tres columnas: Nuevos → Preparando → Listos. Cada toque
 * avanza el pedido (barra_avanzar) y queda registrado quién y a qué hora.
 *
 * Los pedidos llegan solos y al instante (Realtime): en cuanto alguien paga en el tótem,
 * aparece aquí con un aviso sonoro. Nadie del admin interviene.
 */

type Pedido = {
  id: number;
  codigo: string;
  turno: number | null;
  estado: "recibido" | "preparacion" | "entregado" | "cancelado" | "en_camino";
  total: number;
  creado_en: string;
  preparacion_en: string | null;
  listo_en: string | null;
  entregado_en: string | null;
  pedido_items: { cantidad: number; productos: { nombre: string } | null }[];
};

const numero = (p: Pedido) => `#${String(p.turno ?? p.id).padStart(3, "0")}`;
const hora = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", hour12: false }) : "");
const minutosDesde = (iso: string, ahora: number) => Math.max(0, Math.floor((ahora - new Date(iso).getTime()) / 60000));

/** Un "ding" corto con el sintetizador del navegador (sin archivos de audio). */
function sonar() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.frequency.value = 880;
    vol.gain.setValueAtTime(0.25, ctx.currentTime);
    vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(vol).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    // sin audio disponible: no pasa nada
  }
}

export default function PaginaBarra() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [ahora, setAhora] = useState(0);
  const conocidos = useRef<Set<number> | null>(null);

  const cargar = useCallback(async () => {
    const desde = new Date();
    desde.setHours(0, 0, 0, 0);
    const { data, error: e } = await supabase
      .from("pedidos")
      .select("id, codigo, turno, estado, total, creado_en, preparacion_en, listo_en, entregado_en, pedido_items(cantidad, productos(nombre))")
      .eq("canal", "totem")
      .gte("creado_en", desde.toISOString())
      .order("creado_en", { ascending: true });
    if (e) {
      setError(/totem|enum|listo_en|turno/i.test(e.message) ? "Falta la migración 014 en Supabase." : mensajeDeError(e));
      setCargando(false);
      return;
    }
    const lista = ((data as unknown as Pedido[]) ?? []).map((p) => ({ ...p, total: Number(p.total) }));
    // Aviso sonoro solo por pedidos NUEVOS (no al abrir la pantalla).
    if (conocidos.current && lista.some((p) => !conocidos.current!.has(p.id))) sonar();
    conocidos.current = new Set(lista.map((p) => p.id));
    setPedidos(lista);
    setAhora(Date.now());
    setCargando(false);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(cargar, 0);
    const canal = supabase
      .channel("barra")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => cargar())
      .subscribe();
    // El reloj de "hace X min" se actualiza solo.
    const reloj = window.setInterval(() => setAhora(Date.now()), 30_000);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(reloj);
      supabase.removeChannel(canal);
    };
  }, [cargar]);

  const avanzar = async (p: Pedido) => {
    setOcupado(p.id);
    setError("");
    const { error: e } = await supabase.rpc("barra_avanzar", { p_pedido: p.id });
    setOcupado(null);
    if (e) return setError(mensajeDeError(e));
    cargar();
  };

  const nuevos = pedidos.filter((p) => p.estado === "recibido");
  const preparando = pedidos.filter((p) => p.estado === "preparacion" && !p.listo_en);
  const listos = pedidos.filter((p) => p.estado === "preparacion" && p.listo_en);
  const entregados = pedidos.filter((p) => p.estado === "entregado");

  const columna = (titulo: string, lista: Pedido[], accion: string, clase: string) => (
    <section className={`barra__col barra__col--${clase}`} aria-label={titulo}>
      <h2>{titulo} <span>{lista.length}</span></h2>
      {lista.length === 0 ? (
        <p className="caja__vacia">Nada por aquí.</p>
      ) : (
        <ul>
          {lista.map((p) => {
            const min = ahora ? minutosDesde(p.creado_en, ahora) : 0;
            return (
              <li key={p.id} className={`barra-pedido${min >= 8 && clase !== "listos" ? " is-tarde" : ""}`}>
                <div className="barra-pedido__cabeza">
                  <strong>{numero(p)}</strong>
                  <span>{hora(p.creado_en)} · hace {min} min</span>
                </div>
                <ul className="barra-pedido__items">
                  {p.pedido_items.map((i, k) => (
                    <li key={k}><b>{i.cantidad}×</b> {i.productos?.nombre ?? "Producto"}</li>
                  ))}
                </ul>
                <button type="button" className="btn btn--primary barra-pedido__boton" disabled={ocupado === p.id} onClick={() => avanzar(p)}>
                  {ocupado === p.id ? "…" : accion}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  return (
    <div className="equipo__pagina barra">
      <div className="equipo__cabeza">
        <div>
          <p className="eyebrow">Autoservicio</p>
          <h1>Barra</h1>
          <p className="caja__sub">Pedidos del tótem de hoy, ya pagados. Llegan solos y suenan al entrar.</p>
        </div>
        <div className="dato barra__resumen">
          <span className="dato__label">Entregados hoy</span>
          <strong className="dato__valor">{entregados.length}</strong>
          <span className="dato__nota">{formatBs(entregados.reduce((s, p) => s + p.total, 0))}</span>
        </div>
      </div>

      {error && <p className="carrito__error" role="alert">{error}</p>}
      {cargando ? (
        <p className="caja__vacia" aria-busy="true">Cargando pedidos…</p>
      ) : (
        <div className="barra__columnas">
          {columna("Nuevos", nuevos, "Preparar", "nuevos")}
          {columna("Preparando", preparando, "Listo ✓", "preparando")}
          {columna("Listos para retirar", listos, "Entregado", "listos")}
        </div>
      )}
    </div>
  );
}
