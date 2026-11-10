"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCartStore } from "@/store/cartStore";
import { useAuth } from "@/store/authStore";
import { formatBs } from "@/lib/utils";
import { mensajeDeError, supabase } from "@/lib/supabase";
import BolsaVisual from "@/components/tienda/BolsaVisual";

/**
 * Carrito y checkout en 3 pasos (RNF-05): carrito → datos de entrega → pago.
 * Al confirmar, la base de datos (confirmar_pedido) valida y descuenta el stock en una sola
 * transacción, guarda el pedido y suma los puntos (RF-02, RF-21). El pago es de demostración.
 */

const PASOS = ["Carrito", "Entrega", "Pago"];
type Datos = { nombre: string; telefono: string; direccion: string; referencia: string };
const VACIO: Datos = { nombre: "", telefono: "", direccion: "", referencia: "" };

export default function CartDrawer() {
  const { items, isOpen, toggleCart, removeItem, updateQuantity, clearCart } = useCartStore();
  const total = useCartStore((s) => s.total());
  const cantidad = useCartStore((s) => s.itemCount());
  const [paso, setPaso] = useState(0);
  const [datos, setDatos] = useState<Datos>(VACIO);
  const [errores, setErrores] = useState<Partial<Record<keyof Datos, string>>>({});
  const [pago, setPago] = useState<"qr" | "tarjeta">("qr");
  const [pedido, setPedido] = useState<{ codigo: string; total: number } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [errorPedido, setErrorPedido] = useState("");
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

  const pedirCuenta = useAuth((s) => s.pedirCuenta);
  const siguiente = async () => {
    if (paso === 0) {
      // La cuenta se pide recién aquí: el carrito sigue intacto y, al entrar, se pasa a la entrega.
      if (!(await pedirCuenta("Para hacer tu pedido necesitas una cuenta. Tu carrito se mantiene."))) return;
      const p = useAuth.getState().perfil;
      if (p) setDatos((d) => ({ ...d, nombre: d.nombre || p.nombre, telefono: d.telefono || p.telefono || "", direccion: d.direccion || p.direccion || "" }));
    }
    if (paso === 1 && !validar()) return;
    setPaso((p) => p + 1);
  };

  const confirmar = async () => {
    setErrorPedido("");
    if (!(await pedirCuenta("Tu sesión se cerró. Entra de nuevo para confirmar el pedido."))) return;
    setEnviando(true);
    try {
      const { data, error } = await supabase.rpc("confirmar_pedido", {
        items: items.map((it) => ({ producto_id: it.id, cantidad: it.quantity, molienda: it.selectedGrind })),
        p_canal: "web",
        p_metodo: pago,
        p_nombre: datos.nombre.trim(),
        p_telefono: datos.telefono.trim(),
        p_direccion: datos.direccion.trim(),
        p_referencia: datos.referencia.trim() || null,
      });
      if (error) throw error;
      // Guarda teléfono y dirección en el perfil para rellenarlos la próxima vez.
      const id = useAuth.getState().session?.user.id;
      if (id) await supabase.from("perfiles").update({ telefono: datos.telefono.trim(), direccion: datos.direccion.trim() }).eq("id", id);
      await useAuth.getState().cargarPerfil();
      setPedido({ codigo: data.codigo, total: Number(data.total) });
      clearCart();
      setDatos(VACIO);
    } catch (err) {
      setErrorPedido(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
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
              <p className="carrito__numero">{pedido.codigo}</p>
              <p>Recibimos tu pedido por {formatBs(pedido.total)}. Te avisaremos por WhatsApp cuando salga a entrega.</p>
              <p className="carrito__nota">Sumaste {Math.floor(pedido.total / 10)} puntos. Puedes seguir tu pedido en Mi cuenta.</p>
              <div className="carrito__fila">
                <button type="button" className="btn btn--primary" onClick={cerrar}>
                  Seguir comprando
                </button>
                <Link href="/cuenta" className="btn btn--secondary" onClick={cerrar}>
                  Ver mi pedido
                </Link>
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
              <>
                {errorPedido && <p className="carrito__error" role="alert">{errorPedido}</p>}
                <button type="button" className="btn btn--primary carrito__boton" onClick={confirmar} disabled={enviando}>
                  {enviando ? "Confirmando…" : `Confirmar pedido · ${formatBs(total)}`}
                </button>
              </>
            )}
            {paso > 0 && (
              <button type="button" className="link carrito__volver" onClick={() => setPaso((p) => p - 1)}>
                Volver
              </button>
            )}
          </footer>
        )}
      </aside>
    </>
  );
}
