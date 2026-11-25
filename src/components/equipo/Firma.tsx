"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Recuadro para que quien recibe el pedido firme con el dedo o con el mouse.
 *
 * Por qué un canvas y no una foto de una firma en papel: en la puerta de una casa no hay
 * dónde apoyarse para escribir, y una foto de un papel arrugado no se lee. Firmar en la
 * pantalla del celular que el repartidor ya tiene en la mano es lo que hacen las empresas
 * de reparto, y produce una imagen limpia.
 *
 * Detalles que hacen que funcione en celular:
 *
 *  - Eventos de puntero (pointerdown/move/up), no de mouse: así responde igual al dedo, al
 *    lápiz y al mouse sin escribir tres veces la misma lógica.
 *  - `touch-action: none` en el CSS, o el navegador interpreta el trazo como un gesto para
 *    desplazar la página y la firma sale cortada.
 *  - El canvas se dibuja a la resolución real de la pantalla (devicePixelRatio), o en un
 *    celular moderno la línea se ve pixelada.
 *
 * La firma es opcional: no siempre hay quien firme, y bloquear la entrega por eso dejaría
 * pedidos sin cerrar. La foto y el nombre sí son obligatorios.
 */
export default function Firma({ alCambiar }: { alCambiar: (blob: Blob | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const [tieneTrazo, setTieneTrazo] = useState(false);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const escala = window.devicePixelRatio || 1;
    const caja = c.getBoundingClientRect();
    c.width = caja.width * escala;
    c.height = caja.height * escala;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(escala, escala);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // Tinta oscura sobre fondo claro, siempre: la firma se guarda como imagen y se mira
    // después en otra pantalla, donde el tema de la interfaz ya no existe.
    ctx.strokeStyle = "#2a1f1a";
  }, []);

  const punto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const caja = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - caja.left, y: e.clientY - caja.top };
  };

  const empezar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dibujando.current = true;
    const p = punto(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const mover = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dibujando.current) return;
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    const p = punto(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    if (!tieneTrazo) setTieneTrazo(true);
  };

  const soltar = () => {
    if (!dibujando.current) return;
    dibujando.current = false;
    const c = canvas.current;
    if (!c) return;
    // Fondo blanco al exportar: un PNG con fondo transparente se vuelve ilegible si
    // después se mira sobre un tema oscuro.
    const plano = document.createElement("canvas");
    plano.width = c.width;
    plano.height = c.height;
    const ctx = plano.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, plano.width, plano.height);
    ctx.drawImage(c, 0, 0);
    plano.toBlob((b) => alCambiar(b), "image/webp", 0.9);
  };

  const borrar = () => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    setTieneTrazo(false);
    alCambiar(null);
  };

  return (
    <div className="firma">
      <canvas
        ref={canvas}
        className="firma__lienzo"
        onPointerDown={empezar}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerLeave={soltar}
        aria-label="Recuadro para firmar"
      />
      <div className="firma__pie">
        <span>{tieneTrazo ? "Firma lista." : "Firma aquí con el dedo (opcional)."}</span>
        {tieneTrazo && (
          <button type="button" className="link" onClick={borrar}>
            Borrar
          </button>
        )}
      </div>
    </div>
  );
}
