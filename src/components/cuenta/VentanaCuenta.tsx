"use client";

/* eslint-disable @next/next/no-img-element -- export estático: next/image no optimiza aquí */
import Link from "next/link";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/store/authStore";
import { mensajeDeError, recordarSesion, supabase } from "@/lib/supabase";

/**
 * Cuenta de Grano y Aroma con un solo diseño en toda la web: la tarjeta con el molino en
 * loop a la izquierda y el formulario sobre fondo espresso a la derecha.
 *  · VentanaCuenta: la ventana que aparece cuando una acción necesita cuenta (comprar, pujar…);
 *    al entrar, la acción sigue sola.
 *  · TarjetaCuenta: la misma tarjeta para la página /login y el acceso del equipo.
 *  · Modos: iniciar sesión, crear cuenta, recuperar la contraseña y escribir una nueva.
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
      {modal && <TarjetaCuenta motivo={modal.motivo} alTerminar={() => cerrar(true)} alCancelar={() => cerrar(false)} />}
    </dialog>
  );
}

type Modo = "entrar" | "crear" | "recuperar" | "nueva";

type Props = {
  motivo?: string;
  alTerminar: () => void;
  alCancelar?: () => void;
  soloEntrar?: boolean;
  modoInicial?: Modo;
};

type PropsTarjeta = Props & {
  /** A pantalla completa (página /login): sin bordes, con la ola grande y el enlace para volver. */
  pantalla?: boolean;
  volver?: { href: string; texto: string };
  /** Contenido propio del panel en lugar del formulario (por ejemplo "Ya iniciaste sesión"). */
  children?: React.ReactNode;
};

/*
 * La ola entre la foto y el formulario, con acabado de chocolate satinado: el borde toma un
 * tono de chocolate con leche que se oscurece hacia el panel (así el empalme no se nota), un
 * reflejo claro recorre la curva como en una barra templada y una sombra le da volumen sobre
 * la foto. Los trazos no se deforman al estirar el SVG (vector-effect: non-scaling-stroke).
 */
const OLAS = {
  grande: {
    vista: "0 0 100 100",
    // Solo el borde curvo (para el brillo) y la forma completa (para el relleno).
    borde: "M70 0C44 10 30 22 46 38C62 54 12 60 22 78C30 92 58 94 48 100",
    cierre: "H100V0Z",
    desde: 12,
    hasta: 100,
  },
  chica: {
    vista: "0 0 64 100",
    borde: "M38 0C24 12 46 24 34 38C22 52 8 58 22 72C34 84 44 90 30 100",
    cierre: "H64V0Z",
    desde: 8,
    hasta: 64,
  },
} as const;

function OlaChocolate({ grande }: { grande: boolean }) {
  const id = useId().replace(/:/g, "");
  const o = grande ? OLAS.grande : OLAS.chica;
  return (
    <svg
      className={`tarjeta-cuenta__ola${grande ? " tarjeta-cuenta__ola--grande" : ""}`}
      viewBox={o.vista}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        {/* Relleno: chocolate con leche en el borde → espresso del panel. */}
        <linearGradient id={`${id}-relleno`} gradientUnits="userSpaceOnUse" x1={o.desde} y1="0" x2={o.hasta} y2="0">
          <stop offset="0" stopColor="#6b3f27" />
          <stop offset="0.18" stopColor="#4a2c1d" />
          <stop offset="0.45" stopColor="#2c1e17" />
          <stop offset="0.75" stopColor="var(--tc-panel)" />
        </linearGradient>
        {/* El reflejo es más fuerte en el centro de la curva y se apaga en los extremos. */}
        <linearGradient id={`${id}-brillo`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe3c8" stopOpacity="0" />
          <stop offset="0.3" stopColor="#ffe3c8" stopOpacity="0.55" />
          <stop offset="0.62" stopColor="#ffe3c8" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffe3c8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${o.borde}${o.cierre}`} fill={`url(#${id}-relleno)`} />
      {/* Halo ancho y difuso + línea fina: así se ve el brillo de un chocolate templado. */}
      <path d={o.borde} className="tarjeta-cuenta__ola-halo" stroke={`url(#${id}-brillo)`} />
      <path d={o.borde} className="tarjeta-cuenta__ola-brillo" stroke={`url(#${id}-brillo)`} transform="translate(1.6 0)" />
    </svg>
  );
}

export function TarjetaCuenta({ pantalla = false, volver, children, ...props }: PropsTarjeta) {
  return (
    <div className={`tarjeta-cuenta${pantalla ? " tarjeta-cuenta--pantalla" : ""}`}>
      <div className="tarjeta-cuenta__media">
        <FondoMolino />
        {volver && (
          <Link href={volver.href} className="tarjeta-cuenta__volver">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
            {volver.texto}
          </Link>
        )}
        <div className="tarjeta-cuenta__marca">
          <strong>Grano y Aroma</strong>
          <span>Café de especialidad tostado en Sucre</span>
        </div>
        <OlaChocolate grande={pantalla} />
      </div>
      <div className="tarjeta-cuenta__panel">
        <div className="tarjeta-cuenta__contenido">{children ?? <FormularioCuenta {...props} />}</div>
      </div>
    </div>
  );
}

/** El formulario de la tarjeta (también lo usa el acceso del equipo). */
export function FormularioCuenta({ motivo, alTerminar, alCancelar, soloEntrar = false, modoInicial = "entrar" }: Props) {
  const [modo, setModo] = useState<Modo>(modoInicial);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [clave2, setClave2] = useState("");
  const [recordar, setRecordar] = useState(true);
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);

  const cambiarModo = (m: Modo) => {
    setModo(m);
    setError("");
    setAviso("");
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setAviso("");
    const correo = email.trim();
    if (modo === "crear" && !nombre.trim()) return setError("Escribe tu nombre.");
    if (modo !== "nueva" && !/^\S+@\S+\.\S+$/.test(correo)) return setError("Escribe un correo válido, con @.");
    if (modo !== "recuperar" && clave.length < 6) return setError("La contraseña debe tener al menos 6 caracteres.");
    if ((modo === "crear" || modo === "nueva") && clave !== clave2) return setError("Las dos contraseñas no coinciden.");

    setEnviando(true);
    try {
      if (modo === "entrar") {
        recordarSesion(recordar);
        const { error } = await supabase.auth.signInWithPassword({ email: correo, password: clave });
        if (error) throw error;
        alTerminar();
      } else if (modo === "crear") {
        recordarSesion(true);
        const { data, error } = await supabase.auth.signUp({
          email: correo,
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
      } else if (modo === "recuperar") {
        const { error } = await supabase.auth.resetPasswordForEmail(correo, {
          redirectTo: `${window.location.origin}/cuenta/nueva-clave/`,
        });
        if (error) throw error;
        setAviso("Si ese correo tiene una cuenta, te llegará un enlace para elegir una contraseña nueva. Revisa también la carpeta de spam.");
      } else {
        const { error } = await supabase.auth.updateUser({ password: clave });
        if (error) throw error;
        useAuth.getState().avisar("Contraseña actualizada", "Ya puedes usar tu contraseña nueva.");
        alTerminar();
      }
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  };

  const titulo = {
    entrar: ["Hola de nuevo", "Qué bueno verte por aquí."],
    crear: ["Únete a Grano y Aroma", "Crea tu cuenta en un minuto y sigue con tu café."],
    recuperar: ["Recupera tu acceso", "Escribe tu correo y te mandamos un enlace para elegir una contraseña nueva."],
    nueva: ["Elige tu contraseña nueva", "Escríbela dos veces para confirmarla."],
  }[modo];
  const boton = { entrar: "Iniciar sesión", crear: "Crear cuenta", recuperar: "Enviar enlace", nueva: "Guardar contraseña" }[modo];

  return (
    <form className="tc-form" onSubmit={enviar} noValidate>
      {alCancelar && (
        <button type="button" className="tc-form__cerrar" aria-label="Cerrar" onClick={alCancelar}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.6" /></svg>
        </button>
      )}

      <div className="tc-form__cabeza">
        {/* La key reinicia el fundido cada vez que cambia el modo. */}
        <div key={modo} className="tc-anima">
          <h2 id="cuenta-titulo">{titulo[0]}</h2>
          <p>{titulo[1]}</p>
        </div>
        {motivo && (modo === "entrar" || modo === "crear") && <p className="tc-form__motivo">{motivo}</p>}
      </div>

      {!soloEntrar && (modo === "entrar" || modo === "crear") && (
        <div className="tc-form__modos" role="tablist" aria-label="Cuenta" data-modo={modo}>
          <button type="button" role="tab" aria-selected={modo === "entrar"} className={modo === "entrar" ? "is-on" : ""} onClick={() => cambiarModo("entrar")}>
            Iniciar sesión
          </button>
          <button type="button" role="tab" aria-selected={modo === "crear"} className={modo === "crear" ? "is-on" : ""} onClick={() => cambiarModo("crear")}>
            Crear cuenta
          </button>
        </div>
      )}

      {modo === "crear" && (
        <div className="tc-campo tc-anima">
          <label htmlFor="cu-nombre">Nombre</label>
          <input id="cu-nombre" autoComplete="name" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
      )}

      {modo !== "nueva" && (
        <div className="tc-campo">
          <label htmlFor="cu-email">Correo</label>
          <input id="cu-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@correo.com" />
        </div>
      )}

      {modo !== "recuperar" && (
        <div className="tc-campo">
          <label htmlFor="cu-clave">{modo === "nueva" ? "Contraseña nueva" : "Contraseña"}</label>
          <div className="tc-campo__clave">
            <input
              id="cu-clave"
              type={verClave ? "text" : "password"}
              autoComplete={modo === "entrar" ? "current-password" : "new-password"}
              value={clave}
              onChange={(e) => setClave(e.target.value)}
            />
            <button
              type="button"
              className="tc-campo__ojo"
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
      )}

      {(modo === "crear" || modo === "nueva") && (
        <div className="tc-campo tc-anima">
          <label htmlFor="cu-clave2">Repite la contraseña</label>
          <input id="cu-clave2" type={verClave ? "text" : "password"} autoComplete="new-password" value={clave2} onChange={(e) => setClave2(e.target.value)} />
        </div>
      )}

      {modo === "entrar" && (
        <div className="tc-form__fila tc-anima">
          <label className="tc-form__recordar">
            <input type="checkbox" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} />
            Recordarme
          </label>
          <button type="button" className="tc-form__enlace" onClick={() => cambiarModo("recuperar")}>
            ¿Olvidaste tu contraseña?
          </button>
        </div>
      )}

      {error && <p className="tc-form__error" role="alert">{error}</p>}
      {aviso && <p className="tc-form__aviso" role="status">{aviso}</p>}

      <button type="submit" className="tc-form__boton" disabled={enviando}>
        {enviando ? "Un momento…" : boton}
      </button>

      {modo === "recuperar" && (
        <button type="button" className="tc-form__enlace tc-form__volver" onClick={() => cambiarModo("entrar")}>
          ← Volver a iniciar sesión
        </button>
      )}
      {modo === "entrar" && !soloEntrar && (
        <p className="tc-form__pie">
          ¿Primera vez aquí?{" "}
          <button type="button" className="tc-form__enlace" onClick={() => cambiarModo("crear")}>Crea tu cuenta</button>
        </p>
      )}
    </form>
  );
}

const CONSULTA_REDUCIR = "(prefers-reduced-motion: reduce)";
function suscribirReducir(alCambiar: () => void) {
  const mq = window.matchMedia(CONSULTA_REDUCIR);
  mq.addEventListener("change", alCambiar);
  return () => mq.removeEventListener("change", alCambiar);
}

/** El molino en loop (4 s, sin corte). Con "reducir movimiento" queda la imagen fija. */
function FondoMolino() {
  const reducir = useSyncExternalStore(suscribirReducir, () => window.matchMedia(CONSULTA_REDUCIR).matches, () => false);
  if (reducir) return <img src="/video/login-molino-inicio.webp" alt="" aria-hidden="true" />;
  return (
    <video autoPlay muted loop playsInline preload="auto" poster="/video/login-molino-inicio.webp" aria-hidden="true">
      <source src="/video/login-molino.webm" type="video/webm" />
      <source src="/video/login-molino.mp4" type="video/mp4" />
    </video>
  );
}
