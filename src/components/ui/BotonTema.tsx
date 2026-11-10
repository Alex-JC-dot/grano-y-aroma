"use client";

import { useSyncExternalStore } from "react";

/**
 * Botón para alternar entre modo claro y oscuro.
 *
 * El tema ya está puesto en <html data-theme> por el script inline del layout, que corre
 * antes del primer pintado. Este componente solo lo lee para dibujar el icono correcto y
 * lo cambia cuando el usuario pulsa.
 *
 * Decisiones:
 *
 *  - El tema vive en el DOM, no en React, así que se lee con useSyncExternalStore y no con
 *    useState más useEffect. Esa es justamente la herramienta para leer un sistema externo:
 *    devuelve null mientras se hidrata —en el servidor no hay documento— y el valor real en
 *    cuanto el componente corre en el navegador, sin provocar un desajuste de hidratación.
 *    El hueco se reserva con el mismo tamaño, así que la barra no salta.
 *
 *  - El MutationObserver trae de regalo que el botón se mantenga al día si el tema cambia
 *    desde otro sitio, por ejemplo desde otro botón igual en los paneles internos.
 *
 *  - La clase .cambiando-tema se pone un cuarto de segundo para que el cambio se vea como
 *    una transición y no como un corte. Se quita después para no dejar una transición
 *    global pegada a todos los elementos de la página, que arruinaría otras animaciones.
 *
 *  - Dos estados, no tres. Un selector de "claro / oscuro / sistema" es más correcto en
 *    teoría, pero en una barra de navegación obliga a un menú desplegable para algo que
 *    debería ser un toque. El sistema sigue decidiendo el valor inicial de quien no eligió.
 */

type Tema = "light" | "dark";

/** Avisa a React cuando cambia el atributo data-theme de <html>. */
function suscribir(alCambiar: () => void) {
  const observador = new MutationObserver(alCambiar);
  observador.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observador.disconnect();
}

/** Lee el tema del DOM, que es donde lo dejó el script inline del layout. */
function leer(): Tema {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

/** En el servidor no hay documento: null hace que el botón se dibuje vacío. */
function leerEnServidor(): Tema | null {
  return null;
}

export default function BotonTema() {
  const tema = useSyncExternalStore<Tema | null>(suscribir, leer, leerEnServidor);

  const alternar = () => {
    const siguiente: Tema = tema === "dark" ? "light" : "dark";
    const raiz = document.documentElement;

    raiz.classList.add("cambiando-tema");
    raiz.setAttribute("data-theme", siguiente);

    try {
      localStorage.setItem("ga-tema", siguiente);
    } catch {
      // Ventana privada o almacenamiento bloqueado: el tema vale para esta sesión y ya.
    }

    window.setTimeout(() => raiz.classList.remove("cambiando-tema"), 260);
  };

  const esOscuro = tema === "dark";
  const etiqueta = esOscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro";

  return (
    <button
      type="button"
      className="boton-tema"
      onClick={alternar}
      aria-label={etiqueta}
      title={etiqueta}
      aria-pressed={tema === null ? undefined : esOscuro}
      disabled={tema === null}
    >
      {tema === null ? null : esOscuro ? (
        // Sol: lo que obtienes al pulsar estando en oscuro.
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M12 2.6v2.2M12 19.2v2.2M21.4 12h-2.2M4.8 12H2.6M18.6 5.4l-1.6 1.6M7 17l-1.6 1.6M18.6 18.6L17 17M7 7 5.4 5.4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        // Luna: lo que obtienes al pulsar estando en claro.
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M20 14.2A8.4 8.4 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
