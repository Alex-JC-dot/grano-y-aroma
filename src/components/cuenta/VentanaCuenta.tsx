"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/store/authStore";
import { mensajeDeError, supabase } from "@/lib/supabase";

/**
 * Ventana "Entrar / Crear cuenta". Aparece solo cuando una acción la pide (useAuth.pedirCuenta)
 * y, al entrar, la acción continúa sola. También la usa el acceso del equipo.
 */
export default function VentanaCuenta() {
  const modal = useAuth((s) => s.modal);
  const cerrar = useAuth((s) => s.cerrarModal);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (modal && !d.open) d.showModal();
    if (!modal && d.open) d.close();
  }, [modal]);

  return (
    <dialog ref={ref} className="cuenta-dialogo" aria-labelledby="cuenta-titulo" onCancel={() => cerrar(false)}>
      {modal && <FormularioCuenta motivo={modal.motivo} alTerminar={() => cerrar(true)} alCancelar={() => cerrar(false)} />}
    </dialog>
  );
}

export function FormularioCuenta({
  motivo,
  alTerminar,
  alCancelar,
  soloEntrar = false,
}: {
  motivo: string;
  alTerminar: () => void;
  alCancelar?: () => void;
  soloEntrar?: boolean;
}) {
  const [modo, setModo] = useState<"entrar" | "crear">("entrar");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [verClave, setVerClave] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setAviso("");
    if (modo === "crear" && !nombre.trim()) return setError("Escribe tu nombre.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Escribe un correo válido, con @.");
    if (clave.length < 6) return setError("La contraseña debe tener al menos 6 caracteres.");
    setEnviando(true);
    try {
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: clave });
        if (error) throw error;
        alTerminar();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: clave,
          options: { data: { nombre: nombre.trim() } },
        });
        if (error) throw error;
        if (data.session) {
          useAuth.getState().avisar(
            `¡Bienvenido, ${nombre.trim().split(" ")[0]}!`,
            "Tu cuenta se creó correctamente. Ya puedes seguir con lo que estabas haciendo.",
          );
          alTerminar();
        } else {
          setAviso("Te enviamos un correo para confirmar tu cuenta. Ábrelo y luego entra con tu contraseña.");
          setModo("entrar");
        }
      }
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form className="cuenta-form" onSubmit={enviar} noValidate>
      <div className="cuenta-form__cabeza">
        <div>
          <h2 id="cuenta-titulo">{modo === "entrar" ? "Entra a tu cuenta" : "Crea tu cuenta"}</h2>
          <p>{motivo}</p>
        </div>
        {alCancelar && (
          <button type="button" className="carrito__cerrar" aria-label="Cerrar" onClick={alCancelar}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.6" /></svg>
          </button>
        )}
      </div>

      {!soloEntrar && (
        <div className="segmentado cuenta-form__modos" role="tablist">
          <button type="button" role="tab" aria-selected={modo === "entrar"} className={modo === "entrar" ? "is-on" : ""} onClick={() => setModo("entrar")}>Entrar</button>
          <button type="button" role="tab" aria-selected={modo === "crear"} className={modo === "crear" ? "is-on" : ""} onClick={() => setModo("crear")}>Crear cuenta</button>
        </div>
      )}

      {modo === "crear" && (
        <div className="carrito__campo">
          <label htmlFor="cu-nombre">Nombre</label>
          <input id="cu-nombre" autoComplete="name" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
      )}
      <div className="carrito__campo">
        <label htmlFor="cu-email">Correo</label>
        <input id="cu-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="carrito__campo">
        <label htmlFor="cu-clave">Contraseña</label>
        <div className="cuenta-form__clave">
          <input
            id="cu-clave"
            type={verClave ? "text" : "password"}
            autoComplete={modo === "entrar" ? "current-password" : "new-password"}
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          />
          <button
            type="button"
            className="cuenta-form__ojo"
            aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={verClave}
            onClick={() => setVerClave((v) => !v)}
          >
            {verClave ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A9.8 9.8 0 0112 5c5 0 9 4.5 10 7a13 13 0 01-3.2 4.3M6.2 6.2C3.9 7.6 2.5 9.8 2 12c1 2.5 5 7 10 7a9.6 9.6 0 004.3-1" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {error && <p className="carrito__error" role="alert">{error}</p>}
      {aviso && <p className="cuenta-form__aviso" role="status">{aviso}</p>}

      <button type="submit" className="btn btn--primary cuenta-form__boton" disabled={enviando}>
        {enviando ? "Un momento…" : modo === "entrar" ? "Entrar" : "Crear cuenta"}
      </button>
    </form>
  );
}
