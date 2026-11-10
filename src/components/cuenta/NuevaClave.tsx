"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/store/authStore";
import { TarjetaCuenta } from "./VentanaCuenta";

/**
 * /cuenta/nueva-clave: a esta página llega el enlace de "¿Olvidaste tu contraseña?". Supabase
 * abre una sesión temporal con el enlace y aquí se elige la contraseña nueva.
 */
export default function NuevaClave() {
  const router = useRouter();
  const sesion = useAuth((s) => s.session);
  const cargando = useAuth((s) => s.cargando);

  return (
    <section className="login-pagina" aria-label="Contraseña nueva">
      <div className="login-pagina__fondo" aria-hidden="true" />
      <div className="login-pagina__marco">
        {cargando ? (
          <p aria-busy="true">Un momento…</p>
        ) : sesion ? (
          <TarjetaCuenta modoInicial="nueva" soloEntrar alTerminar={() => router.replace("/cuenta/")} />
        ) : (
          <div className="login-pagina__ya">
            <h1>El enlace ya no sirve</h1>
            <p>Los enlaces para cambiar la contraseña vencen pronto o ya se usaron. Pide uno nuevo desde “¿Olvidaste tu contraseña?”.</p>
            <div className="equipo__fila">
              <Link href="/login/" className="btn btn--primary">Ir a iniciar sesión</Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
