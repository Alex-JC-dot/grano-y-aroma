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
  const volver = { href: "/", texto: "Volver a la tienda" };

  return (
    <section className="login-pantalla" aria-label="Contraseña nueva">
      {cargando ? (
        <TarjetaCuenta pantalla volver={volver} alTerminar={() => {}}>
          <p className="tc-form__cabeza" aria-busy="true">Un momento…</p>
        </TarjetaCuenta>
      ) : sesion ? (
        <TarjetaCuenta pantalla volver={volver} modoInicial="nueva" soloEntrar alTerminar={() => router.replace("/cuenta/")} />
      ) : (
        <TarjetaCuenta pantalla volver={volver} alTerminar={() => {}}>
          <div className="tc-form">
            <div className="tc-form__cabeza">
              <h1 id="cuenta-titulo">El enlace ya no sirve</h1>
              <p>Los enlaces para cambiar la contraseña vencen pronto o ya se usaron. Pide uno nuevo desde “¿Olvidaste tu contraseña?”.</p>
            </div>
            <Link href="/login/" className="tc-form__boton tc-form__boton--enlace">Ir a iniciar sesión</Link>
          </div>
        </TarjetaCuenta>
      )}
    </section>
  );
}
