"use client";

import { useCallback, useEffect, useState } from "react";
import { mensajeDeError, supabase } from "@/lib/supabase";
import { formatBs } from "@/lib/utils";

/**
 * Cobros del Club (RF-07), para que el admin supervise.
 *
 * No hay nada que aprobar: el cliente paga por QR y el banco (simulado) lo confirma solo
 * (migración 019). Aquí se ven los últimos cobros, los pagados y los que todavía se esperan.
 */

type Cobro = {
  id: number;
  periodo: string;
  monto: number;
  estado: "pendiente" | "por_verificar" | "aprobado" | "rechazado";
  cliente: { nombre: string } | null;
  suscripciones: { frecuencia: number; gramos: number } | null;
};

const fecha = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("es-BO", { day: "numeric", month: "short", year: "numeric" });

export default function CobrosClub() {
  const [cobros, setCobros] = useState<Cobro[] | null>(null);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    // El nombre del cliente se pide nombrando la clave foránea: cobros_club apunta dos veces a
    // perfiles (quien paga y quien verificó) y, sin decir cuál, la consulta no se resuelve.
    const { data, error: e } = await supabase
      .from("cobros_club")
      .select("id, periodo, monto, estado, cliente:perfiles!cobros_club_cliente_id_fkey(nombre), suscripciones(frecuencia, gramos)")
      .order("creado_en", { ascending: false })
      .limit(8);

    // Un fallo aquí no puede verse como "no hay cobros": son cosas distintas.
    setError(e ? mensajeDeError(e) : "");
    setCobros(((data as unknown as Cobro[]) ?? []).map((c) => ({ ...c, monto: Number(c.monto) })));
  }, []);

  useEffect(() => {
    const t = window.setTimeout(cargar, 0);
    const canal = supabase
      .channel("cobros-club")
      .on("postgres_changes", { event: "*", schema: "public", table: "cobros_club" }, () => cargar())
      .subscribe();
    return () => {
      window.clearTimeout(t);
      supabase.removeChannel(canal);
    };
  }, [cargar]);

  if (cobros === null) return <p aria-busy="true">Cargando cobros…</p>;
  if (error) return <p className="carrito__error" role="alert">{error}</p>;
  if (cobros.length === 0) return <p className="caja__vacia">Todavía no hay cobros del Club.</p>;

  return (
    <div className="tabla-marco tabla-marco--plano">
      <table className="tabla cobros__tabla">
        <thead>
          <tr>
            <th scope="col">Cliente</th>
            <th scope="col">Envío</th>
            <th scope="col" className="num">Monto</th>
            <th scope="col">Estado</th>
          </tr>
        </thead>
        <tbody>
          {cobros.map((c) => (
            <tr key={c.id}>
              <td>
                {c.cliente?.nombre ?? "—"}
                {c.suscripciones && <small>{c.suscripciones.gramos} g · cada {c.suscripciones.frecuencia} días</small>}
              </td>
              <td>{fecha(c.periodo)}</td>
              <td className="num">{formatBs(c.monto)}</td>
              <td>
                <span className={`estado estado--${c.estado === "aprobado" ? "pagado" : "pendiente"}`}>
                  {c.estado === "aprobado" ? "Pagado" : "Esperando el pago"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
