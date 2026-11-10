"use client";

import { useRuta } from "@/lib/ruta";
import Link from "next/link";
import { useAuth } from "@/store/authStore";
import { PANELES } from "@/lib/supabase";
import { FormularioCuenta } from "@/components/cuenta/VentanaCuenta";

/**
 * Protege los paneles del equipo según el rol: sin sesión muestra el acceso del equipo; con
 * un rol que no corresponde, un aviso. La base de datos aplica las mismas reglas (RLS), así
 * que esto es la cara visible de una protección que no depende del navegador.
 */
export default function GuardiaEquipo({ children }: { children: React.ReactNode }) {
  const ruta = useRuta();
  const { session, perfil, cargando } = useAuth();

  if (cargando) return <div className="guardia" aria-busy="true" />;

  if (!session) {
    return (
      <div className="guardia">
        <div className="guardia__caja">
          <FormularioCuenta soloEntrar motivo="Acceso del equipo: entra con la cuenta que te dio el administrador." alTerminar={() => {}} />
        </div>
      </div>
    );
  }

  const permitidos = perfil ? PANELES[perfil.rol] : [];
  if (!permitidos.includes(ruta)) {
    return (
      <div className="guardia">
        <div className="guardia__caja">
          <h1>Este panel no es para tu cuenta</h1>
          <p>
            {perfil?.rol === "cliente"
              ? "Los paneles son solo para el equipo de Grano y Aroma."
              : `Con tu rol (${perfil?.rol}) puedes abrir: ${permitidos.join(", ")}.`}
          </p>
          <div className="equipo__fila">
            {permitidos[0] && <Link href={permitidos[0]} className="btn btn--primary">Ir a mi panel</Link>}
            <Link href="/" className="btn btn--secondary">Volver a la tienda</Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
