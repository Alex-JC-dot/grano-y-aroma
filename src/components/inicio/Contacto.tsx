"use client";

import { useRuta } from "@/lib/ruta";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Sección "Contáctanos": va en el pie, bajo la taza, pero solo se muestra en el Inicio.
 * Valida al enviar y muestra cada error bajo su campo.
 *
 * Pendiente: guardar el mensaje en Supabase (tabla de mensajes de contacto). Hasta entonces
 * el envío solo se confirma en pantalla.
 * Correo y WhatsApp de contacto del equipo.
 */

const MOTIVOS = ["Un pedido o envío", "El Club de suscripción", "Las subastas", "Compras para mi cafetería", "Otro tema"];
type Campos = { nombre: string; email: string; telefono: string; motivo: string; mensaje: string };
const VACIO: Campos = { nombre: "", email: "", telefono: "", motivo: "", mensaje: "" };

export default function Contacto() {
  const ruta = useRuta();
  const [c, setC] = useState<Campos>(VACIO);
  const [err, setErr] = useState<Partial<Record<keyof Campos, string>>>({});
  const [enviado, setEnviado] = useState<string | null>(null);

  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState("");
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const x: typeof err = {};
    if (!c.nombre.trim()) x.nombre = "Escribe tu nombre.";
    if (!/^\S+@\S+\.\S+$/.test(c.email.trim())) x.email = "Escribe un correo con @, por ejemplo nombre@gmail.com.";
    if (c.telefono.trim() && !/^[0-9+\s]{7,}$/.test(c.telefono.trim())) x.telefono = "Escribe al menos 7 dígitos, o déjalo vacío.";
    if (!c.motivo) x.motivo = "Elige sobre qué nos escribes.";
    if (c.mensaje.trim().length < 10) x.mensaje = "Cuéntanos un poco más (al menos 10 letras).";
    setErr(x);
    if (Object.keys(x).length) {
      document.getElementById(`ct-${Object.keys(x)[0]}`)?.focus();
      return;
    }
    setEnviando(true);
    setFallo("");
    const { error: errorBase } = await supabase.from("mensajes").insert({
      nombre: c.nombre.trim(),
      email: c.email.trim(),
      telefono: c.telefono.trim() || null,
      motivo: c.motivo,
      mensaje: c.mensaje.trim(),
    });
    setEnviando(false);
    if (errorBase) {
      setFallo("No pudimos enviar tu mensaje. Revisa tu conexión o escríbenos por WhatsApp.");
      return;
    }
    setEnviado(c.nombre.trim().split(" ")[0]);
    setC(VACIO);
  };

  const ayuda = (k: keyof Campos) =>
    err[k] ? { "aria-invalid": true, "aria-describedby": `ct-${k}-e` } : {};
  const error = (k: keyof Campos) => err[k] && <p id={`ct-${k}-e`} className="contacto__error">{err[k]}</p>;
  const cambiar = (k: keyof Campos) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setC((v) => ({ ...v, [k]: e.target.value }));

  if (ruta !== "/") return null;

  return (
    <section className="contacto" id="contacto" aria-labelledby="contacto-titulo">
      <div className="wrap contacto__grid">
        <div className="contacto__texto" data-revelar>
          <h2 id="contacto-titulo">Contáctanos</h2>
          <p className="contacto__lead">
            ¿Tienes dudas sobre un pedido, el Club o las subastas? Escríbenos y te respondemos por correo.
          </p>
          <dl className="contacto__datos">
            <div>
              <dt>Correo</dt>
              <dd><a href="mailto:alexcalatayud@gmail.com" className="link">alexcalatayud@gmail.com</a></dd>
            </div>
            <div>
              <dt>WhatsApp</dt>
              <dd><a href="https://wa.me/59174814521" className="link" target="_blank" rel="noreferrer">+591 748 14521</a></dd>
            </div>
            <div>
              <dt>Ubicación</dt>
              <dd>Centro histórico, Sucre</dd>
            </div>
          </dl>
        </div>

        <form className="contacto__form" onSubmit={enviar} noValidate data-revelar style={{ "--i": 1 } as React.CSSProperties}>
          {enviado ? (
            <div className="contacto__listo" role="status">
              <h3>Gracias, {enviado}.</h3>
              <p>Recibimos tu mensaje. Te responderemos por correo.</p>
              <button type="button" className="btn btn--secondary" onClick={() => setEnviado(null)}>
                Escribir otro mensaje
              </button>
            </div>
          ) : (
            <>
              <div className="contacto__fila">
                <div className="contacto__campo">
                  <label htmlFor="ct-nombre">Nombre</label>
                  <input id="ct-nombre" autoComplete="name" value={c.nombre} onChange={cambiar("nombre")} {...ayuda("nombre")} />
                  {error("nombre")}
                </div>
                <div className="contacto__campo">
                  <label htmlFor="ct-email">Correo</label>
                  <input id="ct-email" type="email" autoComplete="email" value={c.email} onChange={cambiar("email")} {...ayuda("email")} />
                  {error("email")}
                </div>
              </div>
              <div className="contacto__campo">
                <label htmlFor="ct-telefono">Teléfono (opcional)</label>
                <input id="ct-telefono" type="tel" autoComplete="tel" value={c.telefono} onChange={cambiar("telefono")} {...ayuda("telefono")} />
                {error("telefono")}
              </div>
              <div className="contacto__campo">
                <label htmlFor="ct-motivo">Sobre qué nos escribes</label>
                <select id="ct-motivo" value={c.motivo} onChange={cambiar("motivo")} {...ayuda("motivo")}>
                  <option value="" disabled>
                    Elige una opción
                  </option>
                  {MOTIVOS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
                {error("motivo")}
              </div>
              <div className="contacto__campo">
                <label htmlFor="ct-mensaje">Mensaje</label>
                <textarea id="ct-mensaje" rows={4} value={c.mensaje} onChange={cambiar("mensaje")} {...ayuda("mensaje")} />
                {error("mensaje")}
              </div>
              {fallo && <p className="contacto__error" role="alert">{fallo}</p>}
              <button type="submit" className="btn btn--primary contacto__enviar" disabled={enviando}>
                {enviando ? "Enviando…" : "Enviar mensaje"}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </button>
            </>
          )}
        </form>
      </div>
    </section>
  );
}
