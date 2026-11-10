"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/store/authStore";
import { PANELES, supabase, type Rol } from "@/lib/supabase";
import { TarjetaCuenta } from "./VentanaCuenta";

/**
 * /login: la tarjeta de cuenta a página completa. Al entrar vuelve a donde estaba la persona
 * (?volver=/subastas/) o, si es del equipo, a su panel; si no, a Mi cuenta.
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
    <section className="login-pagina" aria-label="Cuenta">
      <div className="login-pagina__fondo" aria-hidden="true" />
      <div className="login-pagina__marco">
        {!cargando && sesion ? (
          <div className="login-pagina__ya">
            <h1>Ya iniciaste sesión</h1>
            <p>Estás dentro como {perfil?.nombre || sesion.user.email}.</p>
            <div className="equipo__fila">
              <Link href={volver ?? "/cuenta/"} className="btn btn--primary">{volver ? "Seguir" : "Ir a mi cuenta"}</Link>
              <Link href="/tienda/" className="btn btn--secondary">Ver la tienda</Link>
            </div>
          </div>
        ) : (
          <TarjetaCuenta key={modo} modoInicial={modo} alTerminar={alTerminar} />
        )}
      </div>
    </section>
  );
}
