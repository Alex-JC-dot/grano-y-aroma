import { supabase } from "./supabase";

/**
 * El enlace que lleva el QR de pago. Al escanearlo, el celular abre /pagar y esa página avisa al
 * sistema: la pantalla que muestra el QR está escuchando y pasa sola a "¡Pago exitoso!".
 *
 *  · Tienda y Club (?t=código): el aviso llega a la base (pagar_con_qr, migración 021), que pone
 *    el monto y marca el pago. La pantalla se entera por Realtime.
 *  · Caja (?c=código): la venta todavía no existe cuando se muestra el QR; el aviso viaja por un
 *    canal de Realtime con ese código y, al recibirlo, la Caja registra la venta.
 */

const SITIO = "https://grano-y-aroma-a0i0.onrender.com";

/** En la laptop con localhost, el celular no puede entrar: el QR apunta a la página publicada. */
const origen = () => (/^(localhost|127\.|\[::1\])/.test(window.location.hostname) ? SITIO : window.location.origin);

export const enlacePago = (token: string) => `${origen()}/pagar/?t=${token}`;
export const enlaceCaja = (codigo: string, monto: number) => `${origen()}/pagar/?c=${codigo}&m=${monto.toFixed(2)}`;

const canalCaja = (codigo: string) => `pago-caja-${codigo}`;

/** La Caja espera el aviso del celular. Devuelve cómo dejar de esperar. */
export function esperarAvisoCaja(codigo: string, alAvisar: () => void) {
  const canal = supabase.channel(canalCaja(codigo)).on("broadcast", { event: "pagado" }, () => alAvisar()).subscribe();
  return () => {
    supabase.removeChannel(canal);
  };
}

/** El celular avisa a la Caja. */
export function avisarCaja(codigo: string): Promise<boolean> {
  return new Promise((listo) => {
    const canal = supabase.channel(canalCaja(codigo), { config: { broadcast: { ack: true } } });
    const fin = (ok: boolean) => {
      window.clearTimeout(limite);
      supabase.removeChannel(canal);
      listo(ok);
    };
    const limite = window.setTimeout(() => fin(false), 9000);
    canal.subscribe(async (estado) => {
      if (estado === "SUBSCRIBED") fin((await canal.send({ type: "broadcast", event: "pagado", payload: {} })) === "ok");
      else if (estado === "CHANNEL_ERROR" || estado === "TIMED_OUT") fin(false);
    });
  });
}
