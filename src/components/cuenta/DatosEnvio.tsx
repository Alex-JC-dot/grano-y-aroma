"use client";

import { useState } from "react";
import { mensajeDeError, supabase } from "@/lib/supabase";
import { useAuth } from "@/store/authStore";

/**
 * Teléfono y dirección para un envío que todavía no los tiene: antes de pagar el Club (se guardan
 * en la cuenta) o en un pedido propio, como un lote ganado (datos_envio de la migración 023).
 */
export default function DatosEnvio({ pedido, alGuardar }: { pedido?: number; alGuardar?: () => void }) {
  const perfil = useAuth((s) => s.perfil);
  const [telefono, setTelefono] = useState(perfil?.telefono ?? "");
  const [direccion, setDireccion] = useState(perfil?.direccion ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (telefono.replace(/\D/g, "").length < 7) return setError("Escribe un teléfono de al menos 7 dígitos.");
    if (direccion.trim().length < 5) return setError("Escribe la dirección completa, con calle y número.");
    setError("");
    setGuardando(true);
    const id = useAuth.getState().session?.user.id;
    const { error: e1 } = pedido
      ? await supabase.rpc("datos_envio", { p_pedido: pedido, p_telefono: telefono.trim(), p_direccion: direccion.trim() })
      : await supabase.from("perfiles").update({ telefono: telefono.trim(), direccion: direccion.trim() }).eq("id", id ?? "");
    setGuardando(false);
    if (e1) return setError(/datos_envio|schema cache/i.test(e1.message) ? "Falta la migración 023 en Supabase." : mensajeDeError(e1));
    await useAuth.getState().cargarPerfil();
    alGuardar?.();
  };

  return (
    <form className="datos-envio" onSubmit={guardar} noValidate>
      <p><strong>¿A dónde lo enviamos?</strong> Entregamos en Sucre, sin costo.</p>
      <div className="carrito__campo">
        <label htmlFor="envio-tel">Teléfono</label>
        <input id="envio-tel" type="tel" autoComplete="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} disabled={guardando} />
      </div>
      <div className="carrito__campo">
        <label htmlFor="envio-dir">Dirección</label>
        <input id="envio-dir" autoComplete="street-address" placeholder="Calle, número y zona" value={direccion} onChange={(e) => setDireccion(e.target.value)} disabled={guardando} />
      </div>
      {error && <p className="carrito__error" role="alert">{error}</p>}
      <button type="submit" className="btn btn--primary" disabled={guardando}>{guardando ? "Guardando…" : "Guardar y continuar"}</button>
    </form>
  );
}
