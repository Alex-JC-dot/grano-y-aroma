"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { sinMovimiento } from "@/lib/totem";

/**
 * El botón "Toca para pedir" se convierte en el menú: crece desde donde está hasta llenar la
 * pantalla, con la publicidad todavía detrás, y los productos aparecen mientras crece.
 *
 * El botón y el fondo del menú son del mismo crema, así que basta con recortar el menú con la
 * forma del botón y agrandar ese recorte: no hay imágenes ni video nuevos.
 */
export type OrigenApertura = { rect: DOMRect; letra: string };

export default function AperturaTotem({
  origen,
  alTerminar,
  children,
}: {
  /** El botón tocado; null cuando ya terminó de abrirse. */
  origen: OrigenApertura | null;
  alTerminar: () => void;
  children: React.ReactNode;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const [inicial] = useState(origen);

  // Antes del primer pintado, para que no se vea el menú entero un instante.
  useLayoutEffect(() => {
    const c = caja.current;
    if (!c || !inicial || sinMovimiento()) {
      const t = window.setTimeout(alTerminar, 0);
      return () => window.clearTimeout(t);
    }
    const { rect: r } = inicial;
    const recorte = `inset(${r.top}px ${window.innerWidth - r.right}px ${window.innerHeight - r.bottom}px ${r.left}px round ${r.height / 2}px)`;
    const abre = c.animate([{ clipPath: recorte }, { clipPath: "inset(0px 0px 0px 0px round 0px)" }], { duration: 720, easing: "cubic-bezier(0.7, 0, 0.2, 1)", fill: "backwards" });
    // Primero se ve el botón creciendo liso; los productos entran cuando ya hay lugar.
    c.querySelector(".tmenu")?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, delay: 300, easing: "ease-out", fill: "backwards" });
    c.querySelector(".tapertura__texto")?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: "ease-out", fill: "forwards" });
    let vivo = true;
    abre.finished.then(() => vivo && alTerminar(), () => {});
    return () => {
      vivo = false;
      abre.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir
  }, []);

  return (
    <div ref={caja} className={`tapertura${origen ? " is-abriendo" : ""}`}>
      {children}
      {origen && (
        <span className="tapertura__texto" aria-hidden="true" style={{ left: origen.rect.left, top: origen.rect.top, width: origen.rect.width, height: origen.rect.height, fontSize: origen.letra }}>
          Toca para pedir
        </span>
      )}
    </div>
  );
}
