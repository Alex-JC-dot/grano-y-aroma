"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/store/authStore";
import { PANELES, supabase, type Rol } from "@/lib/supabase";
import { TarjetaCuenta } from "./VentanaCuenta";

/**
 * /login a pantalla completa: el molino en loop a la izquierda, la ola y el formulario sobre
 * fondo espresso. Al entrar vuelve a donde estaba la persona (?volver=/subastas/) o, si es del
 * equipo, a su panel; si no, a Mi cuenta.
 */
export default function PaginaLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const sesion = useAuth((s) => s.session);
  const perfil = useAuth((s) => s.perfil);
  const cargando = useAuth((s) => s.cargando);
  const modo = params.get("modo") === "crear" ? "crear" : "entrar";
  const volver = (() => {
    const v = params.get("volver");
    return v && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/login") ? v : null;
  })();
  const enlaceVolver = { href: volver ?? "/", texto: volver ? "Volver" : "Volver a la tienda" };

  const alTerminar = async () => {
    const { data } = await supabase.auth.getUser();
    let rol: Rol | undefined;
    if (data.user) {
      const r = await supabase.from("perfiles").select("rol").eq("id", data.user.id).maybeSingle();
      rol = (r.data?.rol as Rol | undefined) ?? undefined;
    }
    router.replace(volver ?? (rol && rol !== "cliente" ? `${PANELES[rol][0]}/` : "/cuenta/"));
  };

  return (
    <section className="login-pantalla" aria-label="Cuenta">
      {!cargando && sesion ? (
        <TarjetaCuenta pantalla volver={enlaceVolver} alTerminar={() => {}}>
          <div className="tc-form">
            <div className="tc-form__cabeza">
              <h1 id="cuenta-titulo">Ya iniciaste sesión</h1>
              <p>Estás dentro como {perfil?.nombre || sesion.user.email}.</p>
            </div>
            <Link href={volver ?? "/cuenta/"} className="tc-form__boton tc-form__boton--enlace">
              {volver ? "Seguir donde estaba" : "Ir a mi cuenta"}
            </Link>
            <Link href="/tienda/" className="tc-form__enlace tc-form__volver">Ver la tienda</Link>
          </div>
        </TarjetaCuenta>
      ) : (
        <TarjetaCuenta key={modo} pantalla volver={enlaceVolver} modoInicial={modo} alTerminar={alTerminar} />
      )}
    </section>
  );
}
