"use client";

import { useState } from "react";
import { mensajeDeError, supabase } from "@/lib/supabase";
import { useAuth } from "@/store/authStore";
import Gatito, { ElegirGatito, esGato, type Gato } from "./Gatito";

/** La foto de Mi cuenta: el gatito elegido (o la inicial) y el botón para cambiarlo. */
export default function MiGatito() {
  const session = useAuth((s) => s.session);
  const perfil = useAuth((s) => s.perfil);
  const [eligiendo, setEligiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const guardado = session?.user.user_metadata?.avatar;
  const gato = esGato(guardado) ? guardado : null;

  const elegir = async (g: Gato) => {
    setError("");
    if (g === gato) return setEligiendo(false);
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
          {gato ? <Gatito key={gato} gato={gato} /> : <span aria-hidden="true">{(perfil?.nombre ?? session?.user.email ?? "?").charAt(0).toUpperCase()}</span>}
        </span>
        <div>
          <p className="mi-gatito__nombre">{perfil?.nombre}</p>
          <p className="mi-gatito__correo">{session?.user.email}</p>
          <button type="button" className="link mi-gatito__cambiar" aria-expanded={eligiendo} onClick={() => setEligiendo((x) => !x)}>
            {eligiendo ? "Cerrar" : gato ? "Cambiar mi gatito" : "Elegir mi gatito"}
          </button>
        </div>
      </div>
      {eligiendo && <ElegirGatito valor={gato} alElegir={elegir} deshabilitado={guardando} />}
      {error && <p className="carrito__error" role="alert">{error}</p>}
    </div>
  );
}
