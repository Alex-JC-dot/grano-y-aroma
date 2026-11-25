/**
 * Reglas del canje de puntos (RF-32) para el lado del navegador.
 *
 * La autoridad es la base de datos: confirmar_pedido() vuelve a calcular el canje con estas
 * mismas reglas antes de guardar nada (migración 013b). Lo de aquí existe solo para que el
 * cliente vea el total correcto mientras decide cuántos puntos usar. Si alguna vez las dos
 * versiones no coincidieran, manda la base y el pedido queda con lo que ella calculó: por eso
 * el comprobante se arma con lo que vuelve del servidor y no con estas cuentas.
 */

/** Se gana 1 punto por cada Bs. 10 pagados. Sobre lo pagado, no sobre el precio de lista. */
export const puntosPorBs = (monto: number) => Math.max(0, Math.floor(monto / 10));

/** Se canjea 1 punto = Bs. 1. */
export const bsPorPuntos = (puntos: number) => Math.max(0, Math.floor(puntos));

/**
 * El descuento no puede pasar de la mitad del pedido. Sin tope, un cliente con saldo alto se
 * llevaría el café gratis y el negocio dejaría de cubrir el envío y el costo del grano.
 */
export const topeDescuento = (total: number) => Math.floor(total * 0.5);

/** Cuántos puntos puede aplicar de verdad a un pedido: su saldo o el tope, el menor. */
export const puntosAplicables = (saldo: number, total: number) =>
  Math.max(0, Math.min(Math.floor(saldo), topeDescuento(total)));

/** "1 punto" / "2 puntos", para no repetir el condicional en cada pantalla. */
export const enPuntos = (n: number) => `${n} ${Math.abs(n) === 1 ? "punto" : "puntos"}`;
