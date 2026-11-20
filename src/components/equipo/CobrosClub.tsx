"use client";

import { useCallback, useEffect, useState } from "react";
import { mensajeDeError, supabase } from "@/lib/supabase";
import { formatBs } from "@/lib/utils";
import VisorArchivo from "./VisorArchivo";

/**
 * Cobros del Club pendientes de revisar (RF-07).
 *
 * Mismo criterio que los pedidos pagados por QR: el equipo mira el comprobante, comprueba que
 * el monto coincida y recién ahí aprueba. Si rechaza, escribe el motivo, porque un rechazo sin
 * explicación deja al cliente sin saber qué corregir.
 *
 * La lista muestra también los que todavía no tienen comprobante: son los que hay que ir a
 * recordar, y si no se ven, no existen para nadie.
 */

type Estado = "pendiente" | "por_verificar" | "aprobado" | "rechazado";
type Cobro = {
  id: number;
  periodo: string;
  monto: number;
  estado: Estado;
  comprobante: string | null;
  cliente: { nombre: string } | null;
  suscripciones: { frecuencia: number; gramos: number; molienda: string } | null;
};

const fecha = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("es-BO", { day: "numeric", month: "short", year: "numeric" });

export default function CobrosClub() {
  const [cobros, setCobros] = useState<Cobro[] | null>(null);
  const [nota, setNota] = useState("");
  const [abierto, setAbierto] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [viendo, setViendo] = useState<{ ruta: string; titulo: string } | null>(null);

  const cargar = useCallback(async () => {
    // El nombre del cliente se pide nombrando la clave foránea: cobros_club apunta dos veces a
    // perfiles (quien paga y quien verificó) y, sin decir cuál, la consulta no se resuelve.
    const { data, error: e } = await supabase
      .from("cobros_club")
      .select(
        "id, periodo, monto, estado, comprobante, cliente:perfiles!cobros_club_cliente_id_fkey(nombre), suscripciones(frecuencia, gramos, molienda)",
      )
      .neq("estado", "aprobado")
      .order("periodo", { ascending: true });

    // Un fallo aquí no puede verse como "no hay cobros": son cosas distintas y confundirlas
    // hace perder el tiempo buscando un pago que sí estaba.
    if (e) {
      setError(mensajeDeError(e));
      setCobros([]);
      return;
    }
    setError("");
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

  // El comprobante se abre dentro de la página, junto al monto: revisar un pago recordando la
  // cifra de memoria en otra pestaña es justo como se cuelan los errores.
  const ver = (c: Cobro) =>
    c.comprobante && setViendo({ ruta: c.comprobante, titulo: `Cobro del Club · ${formatBs(c.monto)}` });

  const revisar = async (c: Cobro, aprobado: boolean) => {
    if (!aprobado && !nota.trim()) return setError("Escribe por qué lo rechazas: el cliente lo verá.");
    setError("");
    setGuardando(true);
    const { error: e } = await supabase.rpc("verificar_cobro_club", {
      p_cobro: c.id,
      p_aprobado: aprobado,
      p_nota: aprobado ? null : nota.trim(),
    });
    setGuardando(false);
    if (e) return setError(mensajeDeError(e));
    setNota("");
    setAbierto(null);
    cargar();
  };

  if (cobros === null) return <p aria-busy="true">Cargando cobros…</p>;
  if (error && cobros.length === 0) return <p className="carrito__error" role="alert">{error}</p>;
  if (cobros.length === 0) return <p className="filtros__vacio">No hay cobros del Club pendientes.</p>;

  return (
    <>
      {error && <p className="carrito__error" role="alert">{error}</p>}
      {viendo && (
        <VisorArchivo bucket="comprobantes" ruta={viendo.ruta} titulo={viendo.titulo} alCerrar={() => setViendo(null)} />
      )}
      <div className="tabla-marco tabla-marco--plano">
      <table className="tabla cobros__tabla">
        <thead>
          <tr>
            <th scope="col">Cliente</th>
            <th scope="col">Envío</th>
            <th scope="col" className="num">Monto</th>
            <th scope="col">Estado</th>
            <th scope="col">Revisión</th>
          </tr>
        </thead>
        <tbody>
          {cobros.map((c) => (
            <tr key={c.id}>
              <td>
                {c.cliente?.nombre ?? "—"}
                {c.suscripciones && (
                  <small>{c.suscripciones.gramos} g · cada {c.suscripciones.frecuencia} días</small>
                )}
              </td>
              <td>{fecha(c.periodo)}</td>
              <td className="num">{formatBs(c.monto)}</td>
              <td>
                <span className={`estado estado--${c.estado}`}>
                  {c.estado === "por_verificar"
                    ? "Comprobante enviado"
                    : c.estado === "rechazado"
                      ? "Rechazado"
                      : "Sin comprobante"}
                </span>
              </td>
              <td>
                {c.estado === "por_verificar" ? (
                  abierto === c.id ? (
                    <div className="cobros__revision">
                      <button type="button" className="btn btn--secondary" onClick={() => ver(c)}>
                        Ver comprobante
                      </button>
                      <label htmlFor={`nota-${c.id}`} className="cobros__etiqueta">
                        Motivo de rechazo
                      </label>
                      <input
                        id={`nota-${c.id}`}
                        value={nota}
                        onChange={(e) => setNota(e.target.value)}
                        placeholder="El monto no coincide…"
                      />
                      <div className="cobros__botones">
                        <button type="button" className="btn btn--primary" disabled={guardando} onClick={() => revisar(c, true)}>
                          Aprobar
                        </button>
                        <button type="button" className="btn btn--secondary" disabled={guardando} onClick={() => revisar(c, false)}>
                          Rechazar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" className="btn btn--secondary" onClick={() => { setAbierto(c.id); setNota(""); setError(""); }}>
                      Revisar
                    </button>
                  )
                ) : (
                  <small>Esperando que el cliente lo envíe</small>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}
