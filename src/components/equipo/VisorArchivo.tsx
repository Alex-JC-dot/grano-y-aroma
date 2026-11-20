"use client";
/* eslint-disable @next/next/no-img-element -- export estático: next/image no optimiza aquí */

import { useEffect, useRef, useState } from "react";
import { verArchivoPrivado } from "@/lib/archivos";

/**
 * Visor de un archivo privado (comprobante de pago o foto de entrega) dentro de la página.
 *
 * Antes el comprobante se abría en una pestaña nueva. Eso obligaba a quien revisa a saltar
 * de ventana, comparar el monto de memoria y volver, y los navegadores bloqueaban la
 * pestaña cuando el enlace tardaba en llegar. Aquí la imagen se ve al lado de los datos del
 * pedido, que es como se revisa un pago de verdad.
 *
 * El PDF no se incrusta: Chrome y Firefox lo abren con su propio lector y dentro de un
 * diálogo queda minúsculo. Para esos se ofrece el enlace, que es lo que funciona.
 *
 * El enlace firmado dura 10 minutos y se pide recién al abrir el visor, no al cargar la
 * lista: así no se generan decenas de enlaces a archivos que nadie va a mirar.
 */
export default function VisorArchivo({
  bucket,
  ruta,
  titulo,
  alCerrar,
}: {
  bucket: "comprobantes" | "entregas";
  ruta: string;
  titulo: string;
  alCerrar: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const dialogo = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogo.current?.showModal();
    let vivo = true;
    verArchivoPrivado(bucket, ruta)
      .then((u) => {
        if (!vivo) return;
        if (u) setUrl(u);
        else setError("No pudimos abrir el archivo. Puede que ya no esté disponible.");
      })
      .catch(() => vivo && setError("No pudimos abrir el archivo."));
    return () => {
      vivo = false;
    };
  }, [bucket, ruta]);

  const esPdf = ruta.toLowerCase().endsWith(".pdf");

  return (
    <dialog ref={dialogo} className="dialogo visor" onClose={alCerrar} onCancel={alCerrar}>
      <div className="dialogo__cabeza">
        <h2>{titulo}</h2>
        <button type="button" className="carrito__cerrar" aria-label="Cerrar" onClick={() => dialogo.current?.close()}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </button>
      </div>

      <div className="visor__cuerpo">
        {error ? (
          <p className="carrito__error" role="alert">{error}</p>
        ) : !url ? (
          <p className="caja__vacia" aria-busy="true">Abriendo el archivo…</p>
        ) : esPdf ? (
          <p className="visor__pdf">
            El comprobante es un PDF.{" "}
            <a href={url} target="_blank" rel="noreferrer" className="link">Abrirlo en una pestaña nueva</a>
          </p>
        ) : (
          <img src={url} alt={titulo} className="visor__img" />
        )}
      </div>

      {url && !esPdf && (
        <a href={url} target="_blank" rel="noreferrer" className="btn btn--secondary">
          Ver en tamaño completo
        </a>
      )}
    </dialog>
  );
}
