"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/store/authStore";
import { supabase } from "@/lib/supabase";
import { formatBs } from "@/lib/utils";

type Pedido = {
  id: number;
  codigo: string;
  canal: string;
  estado: string;
  total: number;
  nombre: string | null;
  creado_en: string;
  pedido_items: { cantidad: number; molienda: string | null; productos: { nombre: string } | null }[];
};

const ESTADO: Record<string, string> = {
  recibido: "Recibido",
  preparacion: "En preparación",
  en_camino: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

/** Mi cuenta (RF-04): datos, puntos de fidelidad e historial de pedidos. */
export default function PaginaCuenta() {
  const { session, perfil, cargando, pedirCuenta, salir } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("pedidos")
      .select("id, codigo, canal, estado, total, nombre, creado_en, pedido_items(cantidad, molienda, productos(nombre))")
      .eq("cliente_id", session.user.id)
      .order("creado_en", { ascending: false })
      .then(({ data }) => setPedidos((data as unknown as Pedido[]) ?? []));
  }, [session]);

  return (
    <section className="section page-top" aria-labelledby="cuenta-titulo-pag">
      <div className="wrap">
        <div className="head">
          <h1 id="cuenta-titulo-pag">Mi cuenta</h1>
          <div>{perfil && <p>Hola, {perfil.nombre}. Aquí ves tus pedidos, tus puntos y tu suscripción.</p>}</div>
        </div>

        {cargando ? (
          <p aria-busy="true">Cargando…</p>
        ) : !session ? (
          <div className="cuenta__bloque">
            <h2>Entra para ver tu cuenta</h2>
            <p>Tus pedidos, tu suscripción y tus puntos están en tu cuenta.</p>
            <button type="button" className="btn btn--primary" onClick={() => pedirCuenta("Entra para ver tus pedidos y tu suscripción.")}>
              Entrar o crear cuenta
            </button>
          </div>
        ) : (
          <>
            <div className="cuenta">
              <div className="cuenta__bloque">
                <h2>Tus datos</h2>
                <p><strong>{perfil?.nombre}</strong></p>
                <p>{session.user.email}</p>
                <button type="button" className="link equipo__salir" onClick={() => salir()}>Salir de la cuenta</button>
              </div>
              <div className="cuenta__bloque">
                <h2>Tus puntos</h2>
                <p className="cuenta__puntos">{perfil?.puntos ?? 0}</p>
                <p>Ganas 1 punto por cada Bs. 10 de compra.</p>
              </div>
              <div className="cuenta__bloque">
                <h2>Tu suscripción</h2>
                <p>Revisa, pausa o cambia tu suscripción del Club.</p>
                <Link href="/club" className="btn btn--secondary">Ir al Club</Link>
              </div>
            </div>

            <div className="head" style={{ marginTop: 64 }}>
              <h2>Tus pedidos</h2>
            </div>
            {pedidos === null ? (
              <p aria-busy="true">Cargando pedidos…</p>
            ) : pedidos.length === 0 ? (
              <p className="filtros__vacio">
                Todavía no hiciste pedidos. <Link href="/tienda" className="link">Ver la tienda</Link>
              </p>
            ) : (
              <div className="tabla-pujas">
                <table>
                  <thead>
                    <tr><th scope="col">Pedido</th><th scope="col">Productos</th><th scope="col">Fecha</th><th scope="col">Estado</th><th scope="col" className="num">Total</th></tr>
                  </thead>
                  <tbody>
                    {pedidos.map((p) => (
                      <tr key={p.id}>
                        <td>{p.codigo}</td>
                        <td>
                          {p.canal === "subasta" && !p.pedido_items.length
                            ? p.nombre ?? "Lote ganado en subasta"
                            : p.pedido_items
                            .map((i) => `${i.cantidad} × ${i.productos?.nombre ?? "Producto"}${i.molienda && i.molienda !== "Única" ? ` (${i.molienda})` : ""}`)
                            .join(", ")}
                        </td>
                        <td>{new Date(p.creado_en).toLocaleDateString("es-BO", { day: "numeric", month: "long", year: "numeric" })}</td>
                        <td>{ESTADO[p.estado] ?? p.estado}</td>
                        <td className="num">{formatBs(Number(p.total))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
