"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCartStore } from "@/store/cartStore";
import { formatBs } from "@/lib/utils";
import BolsaVisual from "@/components/tienda/BolsaVisual";
import HojaDocumento from "@/components/ui/HojaDocumento";
import { imprimirDocumento, numeroDocumento } from "@/lib/documento";

/**
 * Carrito y checkout en 3 pasos (RNF-05): carrito → datos de entrega → pago.
 * El pago es simulado (QR o tarjeta) hasta conectar la pasarela.
 *
 * Al confirmar se emite el comprobante electrónico de compra (RF-03), descargable en PDF.
 * Antes solo se mostraba un número de pedido suelto, que no es un comprobante: ahora se
 * guarda el detalle de la compra —líneas, método de pago y datos de entrega— en el momento
 * de confirmar, porque justo después se vacía el carrito y esa información se perdería.
 */

const PASOS = ["Carrito", "Entrega", "Pago"];
type Datos = { nombre: string; telefono: string; direccion: string; referencia: string };
const VACIO: Datos = { nombre: "", telefono: "", direccion: "", referencia: "" };

/** Lo que queda registrado al confirmar: el carrito se vacía enseguida. */
type Comprobante = {
  numero: string;
  fecha: string;
  lineas: { nombre: string; detalle: string; cantidad: number; precio: number }[];
  total: number;
  metodo: string;
  cliente: Datos;
};

export default function CartDrawer() {
  const { items, isOpen, toggleCart, removeItem, updateQuantity, clearCart } = useCartStore();
  const total = useCartStore((s) => s.total());
  const cantidad = useCartStore((s) => s.itemCount());
  const [paso, setPaso] = useState(0);
  const [datos, setDatos] = useState<Datos>(VACIO);
  const [errores, setErrores] = useState<Partial<Record<keyof Datos, string>>>({});
  const [pago, setPago] = useState<"qr" | "tarjeta">("qr");
  const [pedido, setPedido] = useState<Comprobante | null>(null);
  const cerrarRef = useRef<HTMLButtonElement>(null);

  // Al abrir, el foco va al botón de cerrar; Escape cierra.
  useEffect(() => {
    if (!isOpen) return;
    cerrarRef.current?.focus();
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && toggleCart();
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [isOpen, toggleCart]);

  const cerrar = () => {
    toggleCart();
    if (pedido) {
      setPedido(null);
      setPaso(0);
    }
  };

  const validar = () => {
    const e: typeof errores = {};
    if (!datos.nombre.trim()) e.nombre = "Escribe tu nombre.";
    if (!/^[0-9+\s]{7,}$/.test(datos.telefono.trim())) e.telefono = "Escribe un teléfono de al menos 7 dígitos.";
    if (!datos.direccion.trim()) e.direccion = "Escribe la dirección de entrega.";
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const siguiente = () => {
    if (paso === 1 && !validar()) return;
    setPaso((p) => p + 1);
  };

  const confirmar = () => {
    // El detalle se copia ANTES de vaciar el carrito; si no, el comprobante saldría vacío.
    setPedido({
      numero: numeroDocumento("GA"),
      fecha: new Date().toLocaleDateString("es-BO", { day: "numeric", month: "long", year: "numeric" }),
      lineas: items.map((i) => ({
        nombre: i.name,
        detalle: i.selectedGrind === "Única" ? (i.presentacion ?? "") : i.selectedGrind,
        cantidad: i.quantity,
        precio: i.price,
      })),
      total,
      metodo: pago === "qr" ? "QR Bolivia" : "Tarjeta de débito o crédito",
      cliente: datos,
    });
    clearCart();
    setDatos(VACIO);
  };

  const campo = (k: keyof Datos, etiqueta: string, tipo = "text", auto?: string) => (
    <div className="carrito__campo">
      <label htmlFor={`c-${k}`}>{etiqueta}</label>
      <input
        id={`c-${k}`}
        type={tipo}
        autoComplete={auto}
        value={datos[k]}
        onChange={(e) => setDatos((d) => ({ ...d, [k]: e.target.value }))}
        aria-invalid={errores[k] ? true : undefined}
        aria-describedby={errores[k] ? `c-${k}-error` : undefined}
      />
      {errores[k] && <p id={`c-${k}-error`} className="carrito__error">{errores[k]}</p>}
    </div>
  );

  return (
    <>
      <div className={`carrito-fondo${isOpen ? " is-open" : ""}`} onClick={cerrar} aria-hidden="true" />
      <aside
        className={`carrito${isOpen ? " is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="carrito-titulo"
        inert={!isOpen}
        aria-hidden={!isOpen}
      >
        <header className="carrito__cabeza">
          <div>
            <h2 id="carrito-titulo">{pedido ? "Pedido confirmado" : PASOS[paso]}</h2>
            {!pedido && (
              <ol className="carrito__pasos" aria-label={`Paso ${paso + 1} de 3`}>
                {PASOS.map((p, i) => (
                  <li key={p} className={i <= paso ? "is-on" : ""} />
                ))}
              </ol>
            )}
          </div>
          <button ref={cerrarRef} type="button" className="carrito__cerrar" onClick={cerrar} aria-label="Cerrar carrito">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
        </header>

        <div className="carrito__cuerpo">
          {pedido ? (
            <div className="carrito__listo">
              <p className="carrito__numero">{pedido.numero}</p>
              <p>Recibimos tu pedido. Te avisaremos por WhatsApp cuando salga a entrega.</p>
              <dl className="carrito__resumen">
                <dt>Entrega estimada</dt><dd>Hoy o mañana en Sucre</dd>
                <dt>Método de pago</dt><dd>{pedido.metodo}</dd>
                <dt>Total pagado</dt><dd>{formatBs(pedido.total)}</dd>
              </dl>
              <div className="carrito__acciones-listo">
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => imprimirDocumento(`Comprobante ${pedido.numero} - Grano y Aroma`)}
                >
                  Descargar comprobante
                </button>
                <button type="button" className="btn btn--primary" onClick={cerrar}>
                  Seguir comprando
                </button>
              </div>
            </div>
          ) : paso === 0 ? (
            items.length === 0 ? (
              <div className="carrito__vacio">
                <p>Tu carrito está vacío.</p>
                <Link href="/tienda" className="btn btn--secondary" onClick={toggleCart}>Ver los cafés</Link>
              </div>
            ) : (
              <ul className="carrito__lista">
                {items.map((it) => (
                  <li key={`${it.id}-${it.selectedGrind}`} className="carrito__linea">
                    <div className="carrito__mini">
                      <BolsaVisual producto={it} />
                    </div>
                    <div className="carrito__info">
                      <p className="carrito__nombre">{it.name}</p>
                      <p className="carrito__detalle">{it.selectedGrind === "Única" ? it.presentacion : it.selectedGrind} · {formatBs(it.price)}</p>
                      <div className="carrito__acciones">
                        <div className="cantidad cantidad--sm">
                          <button type="button" aria-label={`Quitar uno de ${it.name}`} onClick={() => updateQuantity(it.id, it.selectedGrind, it.quantity - 1)}>−</button>
                          <output>{it.quantity}</output>
                          <button type="button" aria-label={`Agregar uno de ${it.name}`} onClick={() => updateQuantity(it.id, it.selectedGrind, it.quantity + 1)}>+</button>
                        </div>
                        <button type="button" className="carrito__quitar" onClick={() => removeItem(it.id, it.selectedGrind)}>
                          Quitar
                        </button>
                      </div>
                    </div>
                    <p className="carrito__subtotal">{formatBs(it.price * it.quantity)}</p>
                  </li>
                ))}
              </ul>
            )
          ) : paso === 1 ? (
            <div className="carrito__form">
              {campo("nombre", "Nombre completo", "text", "name")}
              {campo("telefono", "Teléfono (WhatsApp)", "tel", "tel")}
              {campo("direccion", "Dirección de entrega en Sucre", "text", "street-address")}
              {campo("referencia", "Referencia (opcional)")}
            </div>
          ) : (
            <div className="carrito__form">
              <fieldset className="carrito__pagos">
                <legend>Método de pago</legend>
                {[
                  { v: "qr" as const, t: "QR Bolivia", d: "Escaneas el código desde la app de tu banco." },
                  { v: "tarjeta" as const, t: "Tarjeta de débito o crédito", d: "Visa o Mastercard." },
                ].map((m) => (
                  <label key={m.v} className={`carrito__pago${pago === m.v ? " is-on" : ""}`}>
                    <input type="radio" name="pago" checked={pago === m.v} onChange={() => setPago(m.v)} />
                    <span>
                      <strong>{m.t}</strong>
                      <small>{m.d}</small>
                    </span>
                  </label>
                ))}
              </fieldset>
              <p className="carrito__nota">Pago de demostración: no se realiza ningún cobro real.</p>
              <dl className="carrito__resumen">
                <dt>Subtotal</dt><dd>{formatBs(total)}</dd>
                <dt>Envío en Sucre</dt><dd>Sin costo</dd>
                <dt>Entrega a</dt><dd>{datos.direccion}</dd>
              </dl>
            </div>
          )}
        </div>

        {!pedido && items.length > 0 && (
          <footer className="carrito__pie">
            <div className="carrito__total">
              <span>Total ({cantidad} {cantidad === 1 ? "bolsa" : "bolsas"})</span>
              <strong>{formatBs(total)}</strong>
            </div>
            {paso < 2 ? (
              <button type="button" className="btn btn--primary carrito__boton" onClick={siguiente}>
                {paso === 0 ? "Continuar con la entrega" : "Continuar con el pago"}
              </button>
            ) : (
              <button type="button" className="btn btn--primary carrito__boton" onClick={confirmar}>
                Confirmar pedido · {formatBs(total)}
              </button>
            )}
            {paso > 0 && (
              <button type="button" className="link carrito__volver" onClick={() => setPaso((p) => p - 1)}>
                Volver
              </button>
            )}
          </footer>
        )}
      </aside>

      {/* Comprobante electrónico (RF-03). Invisible en pantalla; es lo único que se imprime. */}
      {pedido && (
        <HojaDocumento
          className="solo-papel imprimible"
          titulo="Comprobante de compra"
          subtitulo={`Emitido el ${pedido.fecha}`}
          numero={pedido.numero}
          etiquetaNumero="Pedido"
          aviso="Comprobante de demostración: esta compra no generó ningún cobro real."
        >
          <section className="doc__bloque">
            <h3>Datos de entrega</h3>
            <dl className="doc__datos">
              <div><dt>Cliente</dt><dd>{pedido.cliente.nombre}</dd></div>
              <div><dt>WhatsApp</dt><dd>{pedido.cliente.telefono}</dd></div>
              <div><dt>Dirección</dt><dd>{pedido.cliente.direccion}</dd></div>
              {pedido.cliente.referencia && (
                <div><dt>Referencia</dt><dd>{pedido.cliente.referencia}</dd></div>
              )}
              <div><dt>Método de pago</dt><dd>{pedido.metodo}</dd></div>
            </dl>
          </section>

          <section className="doc__bloque">
            <h3>Detalle</h3>
            <table className="doc__tabla">
              <thead>
                <tr>
                  <th scope="col">Producto</th>
                  <th scope="col" className="num">Cantidad</th>
                  <th scope="col" className="num">Precio unitario</th>
                  <th scope="col" className="num">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {pedido.lineas.map((l, i) => (
                  <tr key={`${l.nombre}-${l.detalle}-${i}`}>
                    <td>
                      {l.nombre}
                      {l.detalle && <small>{l.detalle}</small>}
                    </td>
                    <td className="num">{l.cantidad}</td>
                    <td className="num">{formatBs(l.precio)}</td>
                    <td className="num">{formatBs(l.precio * l.cantidad)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Envío en Sucre</td>
                  <td className="num">Sin costo</td>
                </tr>
                <tr className="doc__gran-total">
                  <td colSpan={3}>Total</td>
                  <td className="num">{formatBs(pedido.total)}</td>
                </tr>
              </tfoot>
            </table>
          </section>
        </HojaDocumento>
      )}
    </>
  );
}
