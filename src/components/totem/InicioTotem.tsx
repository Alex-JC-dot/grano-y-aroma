"use client";
/* eslint-disable @next/next/no-img-element -- export estático: next/image no optimiza aquí */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Pantalla de inicio del tótem: la publicidad que corre sola mientras nadie lo usa.
 *
 * Un solo video vertical de 22 s en bucle (del cafetal a la taza) hecho con cinco clips; el
 * final se funde con el principio, así que no se nota dónde vuelve a empezar. Las frases no
 * están grabadas en el video: se dibujan encima siguiendo su reloj, por eso se leen nítidas en
 * cualquier pantalla. En los últimos segundos, con la taza servida, crece el logo.
 *
 * Toda la pantalla es el botón: en un tótem la gente toca donde sea.
 */

type Escena = { hasta: number; titulo: string; texto: string };
const ESCENAS: Escena[] = [
  { hasta: 4, titulo: "Nace en Bolivia", texto: "Café de altura" },
  { hasta: 8.5, titulo: "Solo cerezas maduras", texto: "El mejor grano, en su punto" },
  { hasta: 13, titulo: "Tostado en Sucre", texto: "Lotes pequeños, siempre fresco" },
  { hasta: 17.2, titulo: "Preparado al momento", texto: "Espresso recién extraído" },
  { hasta: 19.4, titulo: "Hecho para ti", texto: "Pide, paga y retira en la barra" },
];
/** Después de la última frase y hasta que el video se funde con el principio: solo el logo. */
const CIERRE = ESCENAS.length;
const FIN_CIERRE = 21.6;

const escenaEn = (t: number) => {
  if (t >= FIN_CIERRE) return 0;
  const i = ESCENAS.findIndex((e) => t < e.hasta);
  return i === -1 ? CIERRE : i;
};

const CONSULTA = "(prefers-reduced-motion: reduce)";
const suscribir = (f: () => void) => {
  const mq = window.matchMedia(CONSULTA);
  mq.addEventListener("change", f);
  return () => mq.removeEventListener("change", f);
};

export default function InicioTotem({ alEmpezar }: { alEmpezar: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [escena, setEscena] = useState(0);
  const reducir = useSyncExternalStore(suscribir, () => window.matchMedia(CONSULTA).matches, () => false);

  // Las frases siguen al reloj del video. timeupdate llega unas 4 veces por segundo: alcanza.
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const seguir = () => setEscena(escenaEn(v.currentTime));
    v.addEventListener("timeupdate", seguir);
    // Algunos navegadores de tótem no arrancan solos aunque el video esté en silencio.
    v.play().catch(() => {});
    return () => v.removeEventListener("timeupdate", seguir);
  }, [reducir]);

  const cierre = escena === CIERRE;

  return (
    <button type="button" className={`totem tinicio${cierre ? " is-cierre" : ""}`} onClick={alEmpezar} aria-label="Toca para pedir">
      <span className="tinicio__marco">
        {reducir ? (
          <img className="tinicio__video" src="/totem/inicio.webp" alt="" />
        ) : (
          <video ref={video} className="tinicio__video" autoPlay muted loop playsInline preload="auto" poster="/totem/inicio.webp" aria-hidden="true">
            <source src="/totem/inicio.mp4" type="video/mp4" />
          </video>
        )}
        <span className="tinicio__velo" aria-hidden="true" />

        <img className="tinicio__logo" src="/totem/logo-blanco.webp" alt="Grano y Aroma, café de especialidad" width={1000} height={931} />

        <span className="tinicio__frase" aria-hidden="true">
          {ESCENAS.map((e, i) => (
            <span key={e.titulo} className={`tinicio__escena${i === escena ? " is-on" : ""}`}>
              <strong>{e.titulo}</strong>
              <span>{e.texto}</span>
            </span>
          ))}
        </span>

        <span className="tinicio__boton">
          <span className="tinicio__onda" aria-hidden="true" />
          <span className="tinicio__onda tinicio__onda--2" aria-hidden="true" />
          <span className="tinicio__pastilla">
            <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 11.5V5.2a1.7 1.7 0 0 1 3.4 0v5M12.4 10.2a1.6 1.6 0 0 1 3.1.4M15.5 10.8a1.6 1.6 0 0 1 3.1.6v3.1c0 3.6-2.3 6-5.6 6-2.6 0-4-1.1-5.3-3.1l-2.3-3.6c-.9-1.5.9-3 2.2-1.8L9 13.6" />
            </svg>
            Toca para pedir
          </span>
        </span>

        {!reducir && (
          <span className="tinicio__progreso" aria-hidden="true">
            {ESCENAS.map((e, i) => (
              <span key={e.titulo} className={i <= escena ? "is-on" : ""} />
            ))}
          </span>
        )}
      </span>
    </button>
  );
}
