"use client";

import { useState } from "react";
import { mensajeDeError, supabase } from "@/lib/supabase";
import { useAuth } from "@/store/authStore";
import Gatito, { ElegirGatito, gatoDe, type Gato } from "./Gatito";

/** La foto de Mi cuenta: su gatito y el botón para cambiarlo. */
export default function MiGatito() {
  const session = useAuth((s) => s.session);
  const perfil = useAuth((s) => s.perfil);
  const [eligiendo, setEligiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const gato = session ? gatoDe(session.user) : null;

  const elegir = async (g: Gato) => {
    setError("");
    if (g === session?.user.user_metadata?.avatar) return setEligiendo(false);
    setGuardando(true);
    const { error } = await supabase.auth.updateUser({ data: { avatar: g } });
    setGuardando(false);
    if (error) return setError(mensajeDeError(error));
    setEligiendo(false);
  };

  return (
    <div className="mi-gatito">
      <div className="mi-gatito__cabeza">
        <span className="mi-gatito__foto">
          {gato && <Gatito key={gato} gato={gato} />}
        </span>
        <div>
          <p className="mi-gatito__nombre">{perfil?.nombre}</p>
          <p className="mi-gatito__correo">{session?.user.email}</p>
          <button type="button" className="link mi-gatito__cambiar" aria-expanded={eligiendo} onClick={() => setEligiendo((x) => !x)}>
            {eligiendo ? "Cerrar" : "Cambiar mi gatito"}
          </button>
        </div>
      </div>
      {eligiendo && <ElegirGatito valor={gato} alElegir={elegir} deshabilitado={guardando} />}
      {error && <p className="carrito__error" role="alert">{error}</p>}
    </div>
  );
}
