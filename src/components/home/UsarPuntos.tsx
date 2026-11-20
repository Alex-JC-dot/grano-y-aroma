"use client";

import { bsPorPuntos, enPuntos, puntosAplicables } from "@/lib/puntos";
import { formatBs } from "@/lib/utils";

/**
 * Canje de puntos en el paso de pago (RF-32).
 *
 * El control solo llega hasta donde la regla permite: el saldo del cliente o la mitad del
 * pedido, el menor de los dos. Dejarle pedir más y recortarlo en el servidor sería la forma
 * más rápida de que el total cambie entre lo que vio y lo que terminó pagando.
 *
 * Cuando no tiene saldo no se muestra un control vacío y apagado, sino lo único que le sirve
 * saber ahí: que esta compra le va a dejar puntos para la próxima.
 */
export default function UsarPuntos({
  saldo,
  total,
  valor,
  alCambiar,
  deshabilitado,
}: {
  saldo: number;
  total: number;
  /** Puntos elegidos, ya recortados al máximo por quien nos usa. */
  valor: number;
  alCambiar: (puntos: number) => void;
  deshabilitado?: boolean;
}) {
  const maximo = puntosAplicables(saldo, total);

  if (saldo <= 0)
    return (
      <p className="carrito__nota">
        Con esta compra empiezas a sumar puntos: 1 por cada Bs. 10. En el próximo pedido los podrás
        canjear por descuento.
      </p>
    );

  if (maximo <= 0)
    return (
      <p className="carrito__nota">
        Tienes {enPuntos(saldo)}, pero el descuento no puede pasar de la mitad del pedido. Agrega
        algo más al carrito y los podrás usar.
      </p>
    );

  return (
    <fieldset className="carrito__puntos">
      <legend>Tus puntos</legend>
      <p className="carrito__puntos-saldo">
        Tienes <strong>{saldo}</strong>. Puedes canjear hasta {maximo} en este pedido: 1 punto vale
        Bs. 1 y el descuento llega como máximo a la mitad del total.
      </p>

      <div className="carrito__puntos-control">
        <label htmlFor="carrito-puntos">Canjear</label>
        <input
          id="carrito-puntos"
          type="range"
          min={0}
          max={maximo}
          step={1}
          value={valor}
          disabled={deshabilitado}
          onChange={(e) => alCambiar(Number(e.target.value))}
        />
        <output htmlFor="carrito-puntos" className="carrito__puntos-valor">
          {valor > 0 ? (
            <>
              <strong>{enPuntos(valor)}</strong>
              <small>−{formatBs(bsPorPuntos(valor))}</small>
            </>
          ) : (
            <small>Sin descuento</small>
          )}
        </output>
      </div>

      <div className="carrito__puntos-atajos">
        <button type="button" onClick={() => alCambiar(0)} disabled={deshabilitado || valor === 0}>
          Ninguno
        </button>
        <button type="button" onClick={() => alCambiar(maximo)} disabled={deshabilitado || valor === maximo}>
          Usar el máximo ({maximo})
        </button>
      </div>
    </fieldset>
  );
}
