"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mensajeDeError, panelesDe, supabase } from "@/lib/supabase";
import { formatBs } from "@/lib/utils";
import { imprimirDocumento } from "@/lib/documento";
import { useAuth } from "@/store/authStore";
import { TarjetaCuenta } from "@/components/cuenta/VentanaCuenta";
import { TicketImpresion, TicketVista, turnoTexto, type DatosTicket } from "@/components/totem/TicketTotem";

/**
 * Tótem de autoservicio (EXPOSOFT, migración 014). El cliente, sin cuenta y sin ayuda:
 *
 *   Bienvenida → elige productos → paga con tarjeta de débito (inserta + PIN) → ticket con
 *   su número → "retira en la barra" → vuelve solo al inicio.
 *
 * El pedido entra a la misma base que la tienda y la caja (mismo stock, mismas ventas) con el
 * canal "totem", y aparece al instante en la pantalla de Barra. El pago con tarjeta se
 * aprueba en el momento: nadie del admin tiene que validar nada.
 *
 * Lectura de tarjeta: una página web no puede leer el chip de una tarjeta real (eso exige un
 * lector certificado y el SDK del banco), así que el lector se SIMULA con el mismo flujo que
 * un POS: insertar → PIN → "procesando" → aprobado/rechazado. El PIN 0000 se rechaza para
 * mostrar ese caso.
 *
 * Pantalla táctil: botones grandes, pantalla completa al empezar, y si nadie toca en 60 s
 * vuelve al inicio (el siguiente cliente no debe ver el pedido del anterior).
 */

type Item = { id: string; nombre: string; categoria: string; precio: number; stock: number; grupo: string | null; color: string | null; descripcion: string };
type Linea = Item & { qty: number };
type Fase = "inicio" | "menu" | "pago" | "listo";
type Pago = "insertar" | "leyendo" | "pin" | "procesando" | "rechazado";

const SECCIONES = ["Bebidas calientes", "Métodos", "Bebidas frías", "Pastelería", "Café para llevar", "Otros"];
const seccionDe = (i: Item) => (i.categoria === "bebida" ? i.grupo ?? "Otros" : "Café para llevar");

const INACTIVIDAD = 60_000; // vuelve al inicio sin actividad
const AVISO = 12_000; // antes, pregunta "¿Sigues ahí?"
const VUELTA_TICKET = 25; // segundos con el ticket en pantalla

const espera = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

export default function Totem() {
  const { session, perfil, cargando: cargandoSesion } = useAuth();
  const habilitado = panelesDe(perfil?.rol).includes("/totem");

  if (cargandoSesion) return <div className="totem totem--cargando" aria-busy="true" />;
  if (!session || !habilitado) {
    return (
      <div className="totem totem--activar">
        <div className="totem__activar">
          <TarjetaCuenta
            soloEntrar
            motivo={
              session
                ? "Esta cuenta no puede abrir el tótem. Entra con la cuenta Tótem (o de administrador)."
                : "Activa este tótem una sola vez con la cuenta Tótem. Queda conectado y los clientes ya no tienen que iniciar sesión."
            }
            alTerminar={() => {}}
          />
        </div>
      </div>
    );
  }
  return <Autoservicio />;
}

function Autoservicio() {
  const [fase, setFase] = useState<Fase>("inicio");
  const [items, setItems] = useState<Item[]>([]);
  const [seccion, setSeccion] = useState(SECCIONES[0]);
  const [orden, setOrden] = useState<Linea[]>([]);
  const [pago, setPago] = useState<Pago>("insertar");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [ticket, setTicket] = useState<DatosTicket | null>(null);
  const [preguntar, setPreguntar] = useState(false);
  const [cuenta, setCuenta] = useState(VUELTA_TICKET);
  const ultimoToque = useRef(0);

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from("productos")
      .select("id, nombre, categoria, precio, stock, grupo, color, descripcion")
      .eq("activo", true)
      .in("categoria", ["bebida", "grano"])
      .order("orden");
    setItems(((data as Item[]) ?? []).map((i) => ({ ...i, precio: Number(i.precio) })));
  }, []);

  useEffect(() => {
    const t = window.setTimeout(cargar, 0);
    return () => window.clearTimeout(t);
  }, [cargar]);

  const reiniciar = useCallback(() => {
    setFase("inicio");
    setOrden([]);
    setPago("insertar");
    setPin("");
    setError("");
    setTicket(null);
    setPreguntar(false);
    setSeccion(SECCIONES[0]);
    cargar();
  }, [cargar]);

  // Inactividad: cualquier toque reinicia el reloj; sin toques, pregunta y luego vuelve al inicio.
  useEffect(() => {
    if (fase === "inicio" || fase === "listo") return;
    ultimoToque.current = Date.now();
    const tocar = () => {
      ultimoToque.current = Date.now();
      setPreguntar(false);
    };
    window.addEventListener("pointerdown", tocar);
    const reloj = window.setInterval(() => {
      // Mientras el "banco" procesa no se interrumpe.
      if (pago === "procesando" || pago === "leyendo") return;
      const quieto = Date.now() - ultimoToque.current;
      if (quieto > INACTIVIDAD) reiniciar();
      else if (quieto > INACTIVIDAD - AVISO) setPreguntar(true);
    }, 1000);
    return () => {
      window.removeEventListener("pointerdown", tocar);
      window.clearInterval(reloj);
    };
  }, [fase, pago, reiniciar]);

  // Con el ticket en pantalla: cuenta regresiva y vuelta al inicio.
  useEffect(() => {
    if (fase !== "listo") return;
    const t = window.setInterval(() => setCuenta((c) => c - 1), 1000);
    return () => window.clearInterval(t);
  }, [fase]);
  useEffect(() => {
    if (fase === "listo" && cuenta <= 0) {
      const t = window.setTimeout(reiniciar, 0);
      return () => window.clearTimeout(t);
    }
  }, [fase, cuenta, reiniciar]);

  const empezar = () => {
    // Pantalla completa en el primer toque (los navegadores solo la permiten tras un gesto).
    document.documentElement.requestFullscreen?.().catch(() => {});
    setFase("menu");
  };

  const agregar = (it: Item) =>
    setOrden((o) => {
      const ya = o.find((x) => x.id === it.id)?.qty ?? 0;
      if (ya >= it.stock) return o;
      return ya ? o.map((x) => (x.id === it.id ? { ...x, qty: x.qty + 1 } : x)) : [...o, { ...it, qty: 1 }];
    });
  const cambiar = (id: string, d: number) =>
    setOrden((o) => o.map((x) => (x.id === id ? { ...x, qty: Math.min(x.stock, x.qty + d) } : x)).filter((x) => x.qty > 0));

  const total = orden.reduce((s, l) => s + l.precio * l.qty, 0);
  const unidades = orden.reduce((s, l) => s + l.qty, 0);
  const visibles = items.filter((i) => seccionDe(i) === seccion);
  const secciones = SECCIONES.filter((s) => items.some((i) => seccionDe(i) === s));

  const irAPagar = () => {
    setError("");
    setPin("");
    setPago("insertar");
    setFase("pago");
  };

  // El "lector": el cliente toca la tarjeta (en el tótem real, la inserta en el lector).
  const insertarTarjeta = async () => {
    setPago("leyendo");
    await espera(1400);
    setPago("pin");
  };

  const teclear = (d: string) => setPin((p) => (p.length < 4 ? p + d : p));

  const confirmarPin = async () => {
    if (pin.length < 4) return;
    setPago("procesando");
    setError("");
    await espera(1800); // "consulta al banco"
    if (pin === "0000") {
      setPin("");
      return setPago("rechazado");
    }
    // Pago aprobado: recién ahora se crea el pedido y se descuenta el stock.
    const { data, error: e } = await supabase.rpc("confirmar_pedido", {
      items: orden.map((l) => ({ producto_id: l.id, cantidad: l.qty, molienda: l.categoria === "grano" ? "Grano Entero" : "Única" })),
      p_canal: "totem",
      p_metodo: "tarjeta",
    });
    if (e) {
      setPago("insertar");
      setPin("");
      return setError(/invalid input value for enum|es_totem/i.test(e.message) ? "Falta la migración 014 en Supabase." : mensajeDeError(e));
    }
    setTicket({
      turno: data.turno ?? data.id,
      codigo: data.codigo,
      fecha: new Date(),
      lineas: orden.map((l) => ({ nombre: l.nombre, cantidad: l.qty, precio: l.precio })),
      total: Number(data.total),
      pago: "Tarjeta de débito",
    });
    setCuenta(VUELTA_TICKET);
    setFase("listo");
  };

  // El ticket sale solo al aprobarse el pago.
  useEffect(() => {
    if (fase !== "listo" || !ticket) return;
    const t = window.setTimeout(() => imprimirDocumento(`Ticket ${turnoTexto(ticket.turno)} - Grano y Aroma`), 600);
    return () => window.clearTimeout(t);
  }, [fase, ticket]);

  // ---------- Pantallas ----------
  if (fase === "inicio") {
    return (
      <button type="button" className="totem totem--inicio" onClick={empezar}>
        <span className="totem__inicio-velo" aria-hidden="true" />
        <span className="totem__inicio-texto">
          <span className="totem__marca">Grano y Aroma</span>
          <span className="totem__lema">Café de especialidad tostado en Sucre</span>
          <span className="totem__tocar">Toca para pedir</span>
          <span className="totem__ayuda">Pide, paga con tu tarjeta y retira en la barra</span>
        </span>
      </button>
    );
  }

  if (fase === "listo" && ticket) {
    return (
      <div className="totem totem--listo">
        <div className="totem__listo">
          <span className="cobro__check" aria-hidden="true">✓</span>
          <h1>¡Pago aprobado!</h1>
          <p className="totem__turno-et">Tu número de pedido</p>
          <p className="totem__turno">{turnoTexto(ticket.turno)}</p>
          <p className="totem__lema">Retira tu ticket y espera que llamen tu número en la <strong>barra</strong>.</p>
          <div className="totem__acciones">
            <button type="button" className="btn btn--secondary totem__btn" onClick={() => imprimirDocumento(`Ticket ${turnoTexto(ticket.turno)} - Grano y Aroma`)}>
              Imprimir de nuevo
            </button>
            <button type="button" className="btn btn--primary totem__btn" onClick={reiniciar}>
              Terminar ({cuenta})
            </button>
          </div>
        </div>
        <TicketVista datos={ticket} />
        <TicketImpresion datos={ticket} />
      </div>
    );
  }

  return (
    <div className="totem totem--menu">
      <header className="totem__cabeza">
        <span className="totem__marca">Grano y Aroma</span>
        <button type="button" className="totem__cancelar" onClick={reiniciar}>Cancelar pedido</button>
      </header>

      {fase === "menu" ? (
        <>
          <nav className="totem__secciones" aria-label="Secciones">
            {secciones.map((s) => (
              <button key={s} type="button" className={seccion === s ? "is-on" : ""} aria-pressed={seccion === s} onClick={() => setSeccion(s)}>
                {s}
              </button>
            ))}
          </nav>
          <div className="totem__productos">
            {visibles.map((it) => {
              const en = orden.find((x) => x.id === it.id)?.qty ?? 0;
              const agotado = it.stock <= 0;
              return (
                <button key={it.id} type="button" className={`totem-prod${en ? " is-en" : ""}`} disabled={agotado} onClick={() => agregar(it)}>
                  <span className="totem-prod__icono" style={it.color ? { background: it.color } : undefined} aria-hidden="true">
                    {it.categoria === "grano" ? "☕︎" : "♨︎"}
                  </span>
                  <span className="totem-prod__nombre">{it.nombre}</span>
                  {it.categoria === "grano" && <span className="totem-prod__detalle">Bolsa de 250 g · grano entero</span>}
                  <span className="totem-prod__precio">{agotado ? "Agotado" : formatBs(it.precio)}</span>
                  {en > 0 && <span className="totem-prod__cuantos">{en}</span>}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <PantallaPago
          pago={pago}
          pin={pin}
          total={total}
          error={error}
          alInsertar={insertarTarjeta}
          alTeclear={teclear}
          alBorrar={() => setPin((p) => p.slice(0, -1))}
          alConfirmar={confirmarPin}
          alReintentar={() => { setPago("insertar"); setPin(""); }}
        />
      )}

      <aside className="totem__orden" aria-label="Tu pedido">
        <h2>Tu pedido</h2>
        {orden.length === 0 ? (
          <p className="totem__vacio">Toca un producto para agregarlo.</p>
        ) : (
          <ul>
            {orden.map((l) => (
              <li key={l.id}>
                <span className="totem__lnombre">{l.nombre}<small>{formatBs(l.precio * l.qty)}</small></span>
                {fase === "menu" ? (
                  <span className="totem__cantidad">
                    <button type="button" aria-label={`Quitar uno de ${l.nombre}`} onClick={() => cambiar(l.id, -1)}>−</button>
                    <output>{l.qty}</output>
                    <button type="button" aria-label={`Agregar uno de ${l.nombre}`} onClick={() => cambiar(l.id, 1)}>+</button>
                  </span>
                ) : (
                  <span className="totem__qty">× {l.qty}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="totem__total">
          <span>Total{unidades ? ` · ${unidades} ${unidades === 1 ? "producto" : "productos"}` : ""}</span>
          <strong>{formatBs(total)}</strong>
        </div>
        {fase === "menu" ? (
          <button type="button" className="btn btn--primary totem__btn totem__pagar" disabled={!orden.length} onClick={irAPagar}>
            Pagar con tarjeta
          </button>
        ) : (
          <button type="button" className="btn btn--secondary totem__btn" disabled={pago === "procesando" || pago === "leyendo"} onClick={() => setFase("menu")}>
            Volver al menú
          </button>
        )}
      </aside>

      {preguntar && (
        <div className="totem__sigues" role="alertdialog" aria-label="¿Sigues ahí?">
          <div>
            <h2>¿Sigues ahí?</h2>
            <p>Si no tocas la pantalla, el pedido se cancela en unos segundos.</p>
            <button type="button" className="btn btn--primary totem__btn" onClick={() => setPreguntar(false)}>Sí, sigo aquí</button>
          </div>
        </div>
      )}
    </div>
  );
}

function PantallaPago({
  pago,
  pin,
  total,
  error,
  alInsertar,
  alTeclear,
  alBorrar,
  alConfirmar,
  alReintentar,
}: {
  pago: Pago;
  pin: string;
  total: number;
  error: string;
  alInsertar: () => void;
  alTeclear: (d: string) => void;
  alBorrar: () => void;
  alConfirmar: () => void;
  alReintentar: () => void;
}) {
  return (
    <section className="totem__pago" aria-live="polite">
      <p className="totem__pago-total">Total a pagar <strong>{formatBs(total)}</strong></p>

      {pago === "insertar" || pago === "leyendo" ? (
        <>
          <h1>{pago === "leyendo" ? "Leyendo tarjeta…" : "Inserta o acerca tu tarjeta de débito"}</h1>
          {/* El lector simulado: tocar la tarjeta equivale a insertarla en el lector real. */}
          <button type="button" className={`lector${pago === "leyendo" ? " is-leyendo" : ""}`} onClick={alInsertar} disabled={pago === "leyendo"} aria-label="Insertar tarjeta">
            <span className="lector__ranura" aria-hidden="true" />
            <span className="lector__tarjeta" aria-hidden="true">
              <span className="tarjeta-sim__chip" />
              <span>DÉBITO</span>
            </span>
            <span className="lector__ondas" aria-hidden="true" />
          </button>
          <p className="totem__ayuda">Toca la tarjeta para simular el lector</p>
          {error && <p className="carrito__error" role="alert">{error}</p>}
        </>
      ) : pago === "pin" ? (
        <>
          <h1>Ingresa tu PIN</h1>
          <p className="totem__pin" aria-label={`${pin.length} de 4 dígitos`}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={i < pin.length ? "is-on" : ""} />
            ))}
          </p>
          <div className="teclado">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button key={d} type="button" onClick={() => alTeclear(d)}>{d}</button>
            ))}
            <button type="button" className="teclado__borrar" onClick={alBorrar} aria-label="Borrar">⌫</button>
            <button type="button" onClick={() => alTeclear("0")}>0</button>
            <button type="button" className="teclado__ok" onClick={alConfirmar} disabled={pin.length < 4}>OK</button>
          </div>
          <p className="totem__ayuda">Simulación: cualquier PIN de 4 dígitos se aprueba; 0000 se rechaza.</p>
        </>
      ) : pago === "procesando" ? (
        <div className="totem__procesando">
          <span className="totem__spinner" aria-hidden="true" />
          <h1>Procesando con el banco…</h1>
          <p className="totem__ayuda">No retires la tarjeta</p>
        </div>
      ) : (
        <div className="cobro__resultado cobro__resultado--mal" role="alert">
          <span className="cobro__check" aria-hidden="true">✕</span>
          <strong>Pago rechazado</strong>
          <span>El banco no autorizó el pago (PIN incorrecto). Intenta de nuevo.</span>
          <button type="button" className="btn btn--primary totem__btn" onClick={alReintentar}>Intentar de nuevo</button>
        </div>
      )}
    </section>
  );
}
