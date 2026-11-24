"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mensajeDeError, panelesDe, supabase } from "@/lib/supabase";
import { formatBs } from "@/lib/utils";
import { imprimirDocumento } from "@/lib/documento";
import { fotoDe, rutaFoto, type ItemTotem, type LineaTotem } from "@/lib/totem";
import { useAuth } from "@/store/authStore";
import { TarjetaCuenta } from "@/components/cuenta/VentanaCuenta";
import InicioTotem from "@/components/totem/InicioTotem";
import AperturaTotem, { type OrigenApertura } from "@/components/totem/AperturaTotem";
import MenuTotem from "@/components/totem/MenuTotem";
import CirculoTotem, { type ManejoCirculo } from "@/components/totem/CirculoTotem";
import PagoTotem, { type EstadoPago } from "@/components/totem/PagoTotem";
import { Flecha } from "@/components/totem/DetalleTotem";
import FotoTotem from "@/components/totem/FotoTotem";
import { TicketImpresion, TicketVista, turnoTexto, type DatosTicket } from "@/components/totem/TicketTotem";

/**
 * Tótem de autoservicio (EXPOSOFT, migraciones 014 y 016). El cliente, sin cuenta y sin ayuda:
 *
 *   Publicidad → menú con fotos → "Mi pedido" (círculo) → paga con tarjeta de débito (inserta
 *   + PIN) → ticket con su número → "retira en la barra" → vuelve solo al inicio.
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

type Fase = "inicio" | "menu" | "pedido" | "pago" | "listo";
const MODOS = ["Para aquí", "Para llevar"] as const;

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

/** El stock se comparte entre variantes: dos lattes con distinta leche son dos lattes. */
const cuantos = (o: LineaTotem[], id: string) => o.filter((l) => l.item.id === id).reduce((s, l) => s + l.qty, 0);

function Autoservicio() {
  const [fase, setFase] = useState<Fase>("inicio");
  const [items, setItems] = useState<ItemTotem[]>([]);
  const [populares, setPopulares] = useState<string[]>([]);
  const [orden, setOrden] = useState<LineaTotem[]>([]);
  const [modo, setModo] = useState<(typeof MODOS)[number]>("Para aquí");
  const [origen, setOrigen] = useState({ x: 0, y: 0 });
  const [pago, setPago] = useState<EstadoPago>("insertar");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [ticket, setTicket] = useState<DatosTicket | null>(null);
  const [preguntar, setPreguntar] = useState(false);
  const [cuenta, setCuenta] = useState(VUELTA_TICKET);
  const [vez, setVez] = useState(0); // cambia con cada cliente: el menú vuelve a empezar de cero
  const [apertura, setApertura] = useState<OrigenApertura | null>(null); // el botón mientras crece
  const ultimoToque = useRef(0);
  const circulo = useRef<ManejoCirculo>(null);

  const cargar = useCallback(async () => {
    const productos = () =>
      supabase
        .from("productos")
        .select("id, nombre, categoria, precio, stock, grupo, color, descripcion, presentacion, moliendas, foto")
        .eq("activo", true)
        .order("orden");
    const [elegidos, pops] = await Promise.all([productos().eq("en_totem", true), supabase.rpc("populares_totem")]);
    // Sin la migración 017 todavía no hay qué elegir: se muestra la barra y el café en grano.
    const prods = elegidos.error ? await productos().in("categoria", ["bebida", "grano"]) : elegidos;
    if (prods.error) return; // sin internet: se queda con lo que ya estaba en pantalla
    setItems(((prods.data as ItemTotem[]) ?? []).map((i) => ({ ...i, precio: Number(i.precio) })));
    setPopulares(((pops.data as { producto_id: string }[] | null) ?? []).map((p) => p.producto_id));
  }, []);

  useEffect(() => {
    const t = window.setTimeout(cargar, 0);
    // Si el admin enciende, apaga o cambia un producto, el tótem se actualiza solo.
    const canal = supabase
      .channel("totem-productos")
      .on("postgres_changes", { event: "*", schema: "public", table: "productos" }, () => cargar())
      .subscribe();
    return () => {
      window.clearTimeout(t);
      supabase.removeChannel(canal);
    };
  }, [cargar]);

  const reiniciar = useCallback(() => {
    setFase("inicio");
    setOrden([]);
    setModo("Para aquí");
    setPago("insertar");
    setPin("");
    setError("");
    setTicket(null);
    setPreguntar(false);
    setApertura(null);
    setVez((v) => v + 1);
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

  // Las fotos se descargan durante la publicidad: al abrir el menú ya están listas.
  useEffect(() => {
    if (fase !== "inicio" || !items.length) return;
    const t = window.setTimeout(() => {
      for (const src of new Set([...items.map(fotoDe), rutaFoto("bolsa")])) if (src) new Image().src = src;
    }, 1200);
    return () => window.clearTimeout(t);
  }, [fase, items]);

  const empezar = (origen: OrigenApertura) => {
    if (fase !== "inicio") return; // segundo toque mientras se abre
    setApertura(origen);
    setFase("menu");
  };
  const terminarApertura = useCallback(() => {
    setApertura(null);
    // Pantalla completa al terminar: si cambia de tamaño a mitad de la animación, salta. El
    // permiso del toque dura unos segundos, así que todavía vale.
    document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  const agregar = (item: ItemTotem, qty: number, opciones: string) =>
    setOrden((o) => {
      const entra = Math.min(qty, item.stock - cuantos(o, item.id));
      if (entra <= 0) return o;
      const clave = `${item.id}|${opciones}`;
      return o.some((l) => l.clave === clave)
        ? o.map((l) => (l.clave === clave ? { ...l, qty: l.qty + entra } : l))
        : [...o, { clave, item, opciones, qty: entra }];
    });
  const cambiar = (clave: string, d: number) =>
    setOrden((o) => {
      const linea = o.find((l) => l.clave === clave);
      if (!linea || (d > 0 && cuantos(o, linea.item.id) >= linea.item.stock)) return o;
      return o.map((l) => (l.clave === clave ? { ...l, qty: l.qty + d } : l)).filter((l) => l.qty > 0);
    });

  const total = orden.reduce((s, l) => s + l.item.precio * l.qty, 0);

  const verPedido = (desde: { x: number; y: number }) => {
    setOrigen(desde);
    setError("");
    setFase("pedido");
  };
  const volverAlMenu = () => circulo.current?.cerrar(() => setFase("menu"));

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
      items: orden.map((l) => ({ producto_id: l.item.id, cantidad: l.qty, molienda: l.opciones || "Única" })),
      p_canal: "totem",
      p_metodo: "tarjeta",
      p_referencia: modo,
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
      lineas: orden.map((l) => ({ nombre: l.item.nombre, detalle: l.opciones, cantidad: l.qty, precio: l.item.precio })),
      modo,
      total: Number(data.total),
      pago: "Tarjeta de débito",
    });
    setPago("insertar");
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
            <button type="button" className="tprincipal tprincipal--suave" onClick={() => imprimirDocumento(`Ticket ${turnoTexto(ticket.turno)} - Grano y Aroma`)}>
              Imprimir de nuevo
            </button>
            <button type="button" className="tprincipal" onClick={reiniciar}>
              Terminar ({cuenta})
            </button>
          </div>
        </div>
        <TicketVista datos={ticket} />
        <TicketImpresion datos={ticket} />
      </div>
    );
  }

  const ocupado = pago === "procesando" || pago === "leyendo";
  return (
    <>
      {/* La publicidad sigue detrás mientras el botón crece. */}
      {(fase === "inicio" || apertura) && <InicioTotem key="inicio" alEmpezar={empezar} />}

      {fase !== "inicio" && (
        <AperturaTotem key={vez} origen={apertura} alTerminar={terminarApertura}>
          <MenuTotem
            items={items}
            populares={populares}
            orden={orden}
            total={total}
            alAgregar={agregar}
            alCambiar={cambiar}
            alVerPedido={verPedido}
            alCancelar={reiniciar}
          />
        </AperturaTotem>
      )}

      {(fase === "pedido" || fase === "pago") && (
        <CirculoTotem ref={circulo} origen={origen}>
          <button
            type="button"
            className="tvolver tcirculo__volver"
            disabled={fase === "pago" && ocupado}
            onClick={fase === "pago" ? () => setFase("pedido") : volverAlMenu}
          >
            <Flecha /> Volver
          </button>

          {fase === "pedido" ? (
            <div className="tpedido">
              <h1>Mi pedido</h1>
              <div className="tpedido__modos" role="radiogroup" aria-label="¿Para aquí o para llevar?">
                {MODOS.map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={modo === m} className={modo === m ? "is-on" : ""} onClick={() => setModo(m)}>
                    {m}
                  </button>
                ))}
              </div>
              <ul className="tpedido__lista">
                {orden.map((l) => (
                  <li key={l.clave}>
                    <span className="tpedido__foto"><FotoTotem item={l.item} /></span>
                    <span className="tpedido__nombre">
                      <strong>{l.item.nombre}</strong>
                      {l.opciones && <small>{l.opciones}</small>}
                      <span>{formatBs(l.item.precio * l.qty)}</span>
                    </span>
                    <span className="tcantidad">
                      <button type="button" aria-label={`Quitar uno de ${l.item.nombre}`} onClick={() => cambiar(l.clave, -1)}>−</button>
                      <output>{l.qty}</output>
                      <button type="button" aria-label={`Agregar uno de ${l.item.nombre}`} disabled={cuantos(orden, l.item.id) >= l.item.stock} onClick={() => cambiar(l.clave, 1)}>+</button>
                    </span>
                  </li>
                ))}
                {orden.length === 0 && <li className="tpedido__vacio">Tu pedido quedó vacío. Vuelve al menú y elige algo rico.</li>}
              </ul>
              <div className="tpedido__pie">
                <span>Total<strong>{formatBs(total)}</strong></span>
                <button type="button" className="tprincipal" disabled={!orden.length} onClick={irAPagar}>Pagar con tarjeta</button>
              </div>
            </div>
          ) : (
            <PagoTotem
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
        </CirculoTotem>
      )}

      {preguntar && (
        <div className="totem__sigues" role="alertdialog" aria-label="¿Sigues ahí?">
          <div>
            <h2>¿Sigues ahí?</h2>
            <p>Si no tocas la pantalla, el pedido se cancela en unos segundos.</p>
            <button type="button" className="tprincipal" onClick={() => setPreguntar(false)}>Sí, sigo aquí</button>
          </div>
        </div>
      )}
    </>
  );
}
