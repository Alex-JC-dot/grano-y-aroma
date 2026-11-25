"use client";
/* eslint-disable @next/next/no-img-element -- export estático: next/image no optimiza aquí */

import { useImperativeHandle, useLayoutEffect, useRef } from "react";
import { sinMovimiento } from "@/lib/totem";

/**
 * El círculo: una pantalla color chocolate que crece desde el botón "Ver mi pedido" hasta
 * taparlo todo, y al volver se encoge hasta ese mismo botón. Adentro van "Mi pedido" y el pago.
 */
export type ManejoCirculo = { cerrar: (despues: () => void) => void };

export default function CirculoTotem({
  origen,
  children,
  ref,
}: {
  origen: { x: number; y: number };
  children: React.ReactNode;
  ref?: React.Ref<ManejoCirculo>;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const cerrando = useRef(false);

  const animar = (abrir: boolean) => {
    const c = caja.current;
    if (!c || sinMovimiento()) return null;
    const { x, y } = origen;
    const radio = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const cuadros = [{ clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${Math.ceil(radio)}px at ${x}px ${y}px)` }];
    return c.animate(abrir ? cuadros : cuadros.reverse(), { duration: abrir ? 720 : 520, easing: "cubic-bezier(0.65, 0, 0.2, 1)", fill: abrir ? "none" : "forwards" });
  };

  useLayoutEffect(() => {
    animar(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir
  }, []);

  useImperativeHandle(ref, () => ({
    cerrar: (despues) => {
      if (cerrando.current) return;
      cerrando.current = true;
      const a = animar(false);
      if (!a) return despues();
      a.finished.then(despues, despues);
    },
  }));

  return (
    <div ref={caja} className="tcirculo">
      <img className="tcirculo__logo" src="/totem/logo-blanco.webp" alt="Grano y Aroma" width={1000} height={931} />
      {children}
    </div>
  );
}
