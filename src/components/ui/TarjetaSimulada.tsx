"use client";

/**
 * Formulario de tarjeta SIMULADO, compartido por la Caja (cobro en el local) y el carrito de la
 * tienda en línea. No hay pasarela real: se valida como lo haría una (número con el algoritmo
 * de Luhn, vencimiento, CVV) y se "consulta al banco" con una espera corta.
 *
 * Tarjetas de prueba: 4242 4242 4242 4242 se aprueba; 4000 0000 0000 0002 la rechaza el banco
 * (para mostrar ese caso). Los datos NO se guardan: viven en el estado de quien usa el
 * formulario y la venta solo registra el método "tarjeta".
 */

export type DatosTarjeta = { numero: string; nombre: string; vence: string; cvv: string };
export const TARJETA_VACIA: DatosTarjeta = { numero: "", nombre: "", vence: "", cvv: "" };

/** Algoritmo de Luhn: el dígito verificador que traen todas las tarjetas reales. */
function luhnValido(numero: string) {
  let suma = 0;
  let doble = false;
  for (let i = numero.length - 1; i >= 0; i--) {
    let d = Number(numero[i]);
    if (doble) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    suma += d;
    doble = !doble;
  }
  return numero.length >= 13 && suma % 10 === 0;
}

/** Devuelve el problema de los datos, o null si están bien. */
export function validarTarjeta(t: DatosTarjeta): string | null {
  const [mm, aa] = t.vence.split("/").map(Number);
  if (!luhnValido(t.numero)) return "El número de tarjeta no es válido. Revisa los 16 dígitos.";
  if (!t.nombre.trim()) return "Escribe el nombre como figura en la tarjeta.";
  if (!(mm >= 1 && mm <= 12) || !aa) return "El vencimiento va así: MM/AA.";
  if (new Date(2000 + aa, mm, 1) <= new Date()) return "La tarjeta está vencida.";
  if (!/^\d{3,4}$/.test(t.cvv)) return "El CVV son los 3 dígitos del reverso.";
  return null;
}

/** "Consulta al banco": espera un momento y responde si autoriza el pago. */
export async function consultarBanco(t: DatosTarjeta): Promise<boolean> {
  await new Promise((r) => window.setTimeout(r, 1600));
  return !t.numero.endsWith("0002");
}

const marcaDe = (n: string) => (/^4/.test(n) ? "Visa" : /^5[1-5]|^2[2-7]/.test(n) ? "Mastercard" : /^3[47]/.test(n) ? "American Express" : "");
const agrupar = (n: string) => n.replace(/(\d{4})(?=\d)/g, "$1 ");

export default function FormTarjeta({
  datos,
  alCambiar,
  deshabilitado = false,
  prefijo = "t",
}: {
  datos: DatosTarjeta;
  alCambiar: (d: DatosTarjeta) => void;
  deshabilitado?: boolean;
  /** Para que los id de los campos no choquen si hay dos formularios en la página. */
  prefijo?: string;
}) {
  const poner = (k: keyof DatosTarjeta, v: string) => alCambiar({ ...datos, [k]: v });
  const marca = marcaDe(datos.numero);

  return (
    <div className="tarjeta-form">
      {/* Vista previa de la tarjeta mientras se escribe. */}
      <div className="tarjeta-sim" aria-hidden="true">
        <span className="tarjeta-sim__chip" />
        <span className="tarjeta-sim__marca">{marca || "Tarjeta"}</span>
        <span className="tarjeta-sim__numero">{agrupar(datos.numero.padEnd(16, "•"))}</span>
        <span className="tarjeta-sim__pie">
          <span>{datos.nombre.trim().toUpperCase() || "NOMBRE APELLIDO"}</span>
          <span>{datos.vence || "MM/AA"}</span>
        </span>
      </div>

      <div className="carrito__campo">
        <label htmlFor={`${prefijo}-numero`}>Número de tarjeta</label>
        <input
          id={`${prefijo}-numero`}
          inputMode="numeric"
          autoComplete="off"
          placeholder="4242 4242 4242 4242"
          value={agrupar(datos.numero)}
          onChange={(e) => poner("numero", e.target.value.replace(/\D/g, "").slice(0, 16))}
          disabled={deshabilitado}
        />
      </div>
      <div className="carrito__campo">
        <label htmlFor={`${prefijo}-nombre`}>Nombre en la tarjeta</label>
        <input id={`${prefijo}-nombre`} autoComplete="off" value={datos.nombre} onChange={(e) => poner("nombre", e.target.value)} disabled={deshabilitado} />
      </div>
      <div className="tarjeta-form__fila">
        <div className="carrito__campo">
          <label htmlFor={`${prefijo}-vence`}>Vence</label>
          <input
            id={`${prefijo}-vence`}
            inputMode="numeric"
            autoComplete="off"
            placeholder="MM/AA"
            value={datos.vence}
            onChange={(e) => {
              const d = e.target.value.replace(/\D/g, "").slice(0, 4);
              poner("vence", d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
            }}
            disabled={deshabilitado}
          />
        </div>
        <div className="carrito__campo">
          <label htmlFor={`${prefijo}-cvv`}>CVV</label>
          <input
            id={`${prefijo}-cvv`}
            inputMode="numeric"
            autoComplete="off"
            type="password"
            placeholder="123"
            value={datos.cvv}
            onChange={(e) => poner("cvv", e.target.value.replace(/\D/g, "").slice(0, 4))}
            disabled={deshabilitado}
          />
        </div>
      </div>

      <p className="tarjeta-form__aviso">
        Simulación: no se cobra ni se guarda nada. Tarjeta de prueba <strong>4242 4242 4242 4242</strong> (aprobada) o{" "}
        <strong>4000 0000 0000 0002</strong> (rechazada), con cualquier vencimiento futuro y CVV.
      </p>
    </div>
  );
}
