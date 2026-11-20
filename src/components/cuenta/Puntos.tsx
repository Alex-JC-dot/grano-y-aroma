"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatBs } from "@/lib/utils";
import { bsPorPuntos } from "@/lib/puntos";

/**
 * Puntos de fidelidad en Mi cuenta (RF-32): el saldo y de dónde salió.
 *
 * El saldo solo no alcanza. Un número que sube y baja sin explicación no se puede reclamar: si
 * el cliente cree que le faltan puntos, necesita ver qué compra se los dio y en qué pedido los
 * gastó. De eso se encarga movimientos_puntos, que la base escribe sola en cada pedido y en
 * cada cancelación (migración 013).
 *
 * La consulta no filtra por cliente: lo hace la política de RLS de la tabla. Pedir solo lo
 * propio y que la base lo verifique son dos cosas distintas; aquí vale la segunda.
 */

type Movimiento = { id: number; puntos: number; motivo: string; creado_en: string };

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-BO", { day: "numeric", month: "short", year: "numeric" });

export default function Puntos({ saldo }: { saldo: number }) {
  const [movimientos, setMovimientos] = useState<Movimiento[] | null>(null);

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from("movimientos_puntos")
      .select("id, puntos, motivo, creado_en")
      .order("creado_en", { ascending: false })
      .limit(8);
    setMovimientos((data as Movimiento[]) ?? []);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(cargar, 0);
    return () => window.clearTimeout(t);
  }, [cargar]);

  return (
    <div className="cuenta__bloque">
      <h2>Tus puntos</h2>
      <p className="cuenta__puntos">{saldo}</p>
      <p>
        Ganas 1 punto por cada Bs. 10 de compra y cada punto vale Bs. 1 de descuento en el
        siguiente pedido.
        {saldo > 0 && <> Ahora mismo tienes {formatBs(bsPorPuntos(saldo))} para canjear.</>}
      </p>

      {movimientos === null ? (
        <p aria-busy="true">Cargando movimientos…</p>
      ) : movimientos.length === 0 ? (
        <p className="cuenta__puntos-vacio">
          Todavía no hay movimientos. Tu primera compra aparecerá acá.
        </p>
      ) : (
        <ul className="cuenta__movimientos">
          {movimientos.map((m) => (
            <li key={m.id}>
              <span className={`cuenta__mov-signo${m.puntos < 0 ? " is-resta" : ""}`}>
                {m.puntos > 0 ? `+${m.puntos}` : m.puntos}
              </span>
              <span className="cuenta__mov-motivo">
                {m.motivo}
                <small>{fecha(m.creado_en)}</small>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
