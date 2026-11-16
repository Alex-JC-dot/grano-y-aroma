"use client";
/* eslint-disable @next/next/no-img-element -- export estático: next/image no optimiza aquí */

import { useEffect, useState } from "react";
import { verArchivoPrivado } from "@/lib/archivos";

/**
 * La constancia de entrega que ve el cliente en Mi cuenta: la foto que tomó el repartidor,
 * quién recibió el pedido y a qué hora.
 *
 * Es la otra mitad de la prueba de entrega. Al equipo le sirve para responder un reclamo; al
 * cliente, para enterarse de que su pedido llegó aunque él no estuviera —lo recibió un
 * familiar, quedó en portería— sin tener que llamar a preguntar.
 *
 * La foto vive en un bucket privado, así que se pide un enlace firmado al abrir la tarjeta.
 * Solo se pide una vez y solo si hay foto: los pedidos cerrados antes de la migración 010 no
 * tienen ninguna, y entonces se muestran los datos sin imagen en vez de un hueco roto.
 */

const CALIDAD: Record<string, string> = {
  titular: "en tus manos",
  familiar: "un familiar",
  portero: "portería o recepción",
  vecino: "un vecino",
  otro: "otra persona",
};

export default function PruebaEntrega({
  foto,
  recibidoPor,
  tipo,
  nota,
  firma,
  cuando,
  repartidor,
}: {
  foto: string | null;
  recibidoPor: string | null;
  tipo: string | null;
  nota: string | null;
  firma?: string | null;
  cuando: string | null;
  repartidor: string | null;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [urlFirma, setUrlFirma] = useState<string | null>(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    if (!foto) return;
    let vivo = true;
    verArchivoPrivado("entregas", foto)
      .then((u) => vivo && (u ? setUrl(u) : setFallo(true)))
      .catch(() => vivo && setFallo(true));
    return () => {
      vivo = false;
    };
  }, [foto]);

  useEffect(() => {
    if (!firma) return;
    let vivo = true;
    verArchivoPrivado("entregas", firma)
      .then((u) => vivo && u && setUrlFirma(u))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [firma]);

  // Nada que mostrar: pedido entregado antes de que se pidiera constancia.
  if (!foto && !recibidoPor) return null;

  const momento = cuando
    ? new Date(cuando).toLocaleString("es-BO", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false })
    : null;

  return (
    <section className="prueba-entrega" aria-label="Constancia de entrega">
      <h3>Tu pedido fue entregado</h3>

      {foto && !fallo && (
        <figure className="prueba-entrega__foto">
          {url ? (
            <a href={url} target="_blank" rel="noreferrer">
              <img src={url} alt="Foto tomada al entregar tu pedido" loading="lazy" />
            </a>
          ) : (
            <span className="prueba-entrega__cargando" aria-busy="true">Cargando la foto…</span>
          )}
          <figcaption>Foto tomada al dejar tu pedido.</figcaption>
        </figure>
      )}

      <dl className="prueba-entrega__datos">
        {momento && (
          <div>
            <dt>Cuándo</dt>
            <dd>{momento}</dd>
          </div>
        )}
        {recibidoPor && (
          <div>
            <dt>Recibió</dt>
            <dd>
              {recibidoPor}
              {tipo && CALIDAD[tipo] && <small>Quedó {CALIDAD[tipo]}.</small>}
            </dd>
          </div>
        )}
        {repartidor && (
          <div>
            <dt>Entregó</dt>
            <dd>{repartidor}</dd>
          </div>
        )}
        {nota && (
          <div>
            <dt>Nota del repartidor</dt>
            <dd>{nota}</dd>
          </div>
        )}
      </dl>

      {urlFirma && (
        <figure className="prueba-entrega__firma">
          <img src={urlFirma} alt={`Firma de ${recibidoPor ?? "quien recibió"}`} loading="lazy" />
          <figcaption>Firma de quien recibió.</figcaption>
        </figure>
      )}

      <p className="prueba-entrega__pie">
        ¿Algo no cuadra? Escríbenos por WhatsApp con el número de pedido y lo revisamos.
      </p>
    </section>
  );
}
