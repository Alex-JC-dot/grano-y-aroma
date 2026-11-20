/**
 * QR de pago en formato EMVCo (Merchant Presented Mode), que es el estándar que leen las
 * aplicaciones bancarias, incluidas las bolivianas.
 *
 * Antes el QR llevaba una frase suelta: al escanearlo, el teléfono mostraba texto y la app del
 * banco no reconocía nada. Un QR de pago no es una imagen con un texto adentro: es una cadena
 * con una estructura, y si no la tiene, ninguna app sabe qué hacer con ella.
 *
 * La estructura son campos "etiqueta + longitud + valor", uno detrás de otro, y al final un
 * código de control (CRC) que la app usa para saber si el QR se leyó entero o vino cortado.
 *
 *   00  versión del formato          53  moneda (068 = boliviano)
 *   01  tipo: 11 reutilizable, 12 de un solo uso
 *   26  datos de la cuenta           54  monto
 *   52  rubro del comercio           58  país (BO)
 *   59  nombre del comercio          60  ciudad
 *   62  datos extra (nuestro código de pedido)
 *   63  código de control
 *
 * LA CUENTA ES INVENTADA, a propósito. El QR es válido y la app del banco lo abre con el monto
 * ya cargado, que es lo que hay que poder mostrar; pero no apunta a ninguna cuenta de nadie, así
 * que nadie puede transferir dinero por error al probarlo en la feria. Para cobrar de verdad hay
 * que reemplazar GUID y CUENTA por los que entregue el banco al afiliar el comercio.
 */

const GUID = "BO.GRANOYAROMA.DEMO";   // identificador del esquema; el banco da el suyo al afiliar
const CUENTA = "0000000000000000";    // cuenta inventada: no existe y no recibe nada
const RUBRO = "5812";                 // cafeterías y restaurantes
const MONEDA = "068";                 // boliviano (ISO 4217)
const PAIS = "BO";
const COMERCIO = "GRANO Y AROMA";     // hasta 25 caracteres
const CIUDAD = "SUCRE";               // hasta 15

/** Un campo: dos dígitos de etiqueta, dos de longitud y el valor. */
const campo = (etiqueta: string, valor: string) =>
  `${etiqueta}${String(valor.length).padStart(2, "0")}${valor}`;

/**
 * CRC-16/CCITT-FALSE: polinomio 0x1021, valor inicial 0xFFFF, sin reflejar ni invertir.
 *
 * Se calcula sobre TODO el payload incluyendo la etiqueta y la longitud del propio control
 * ("6304"), y el resultado son cuatro hexadecimales en mayúscula. Se recorre byte a byte, no
 * carácter a carácter: un nombre con acentos ocupa más bytes que letras y el cálculo cambiaría.
 */
export function crc16(cadena: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(cadena)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Recorta y limpia un texto al límite que permite su campo. */
const recortar = (texto: string, largo: number) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")   // las apps viejas tropiezan con los acentos
    .slice(0, largo)
    .trim();

/**
 * Arma el contenido del QR para un cobro.
 *
 * @param monto    en bolivianos; va con dos decimales y punto, como pide el estándar
 * @param referencia  nuestro código de pedido o de cobro, para conciliar después
 */
export function qrDePago(monto: number, referencia: string): string {
  const cuerpo =
    campo("00", "01") +
    campo("01", "12") +                                   // de un solo uso: lleva monto
    campo("26", campo("00", GUID) + campo("01", CUENTA)) +
    campo("52", RUBRO) +
    campo("53", MONEDA) +
    campo("54", Math.max(0, monto).toFixed(2)) +
    campo("58", PAIS) +
    campo("59", recortar(COMERCIO, 25)) +
    campo("60", recortar(CIUDAD, 15)) +
    campo("62", campo("05", recortar(referencia, 25)));

  // El "6304" entra en el cálculo: por eso se concatena antes de calcular.
  const conEtiqueta = `${cuerpo}6304`;
  return conEtiqueta + crc16(conEtiqueta);
}
