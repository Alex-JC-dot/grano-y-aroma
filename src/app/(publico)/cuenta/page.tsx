"use client";

import Link from "next/link";
import { useAuth } from "@/store/authStore";
import MisPedidos from "@/components/cuenta/MisPedidos";
import Puntos from "@/components/cuenta/Puntos";

/** Mi cuenta (RF-04): datos, puntos de fidelidad y pedidos con su seguimiento y pago. */
export default function PaginaCuenta() {
  const { session, perfil, cargando, pedirCuenta, salir } = useAuth();

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
              <Puntos saldo={perfil?.puntos ?? 0} />
              <div className="cuenta__bloque">
                <h2>Tu suscripción</h2>
                <p>Revisa, pausa o cambia tu suscripción del Club.</p>
                <Link href="/club" className="btn btn--secondary">Ir al Club</Link>
              </div>
            </div>

            <div className="head" style={{ marginTop: 64 }}>
              <h2>Tus pedidos</h2>
            </div>
            <MisPedidos uid={session.user.id} />
          </>
        )}
      </div>
    </section>
  );
}
