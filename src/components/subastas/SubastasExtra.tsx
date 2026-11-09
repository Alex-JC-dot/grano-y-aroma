"use client";

/* eslint-disable @next/next/no-img-element -- export estático: next/image no optimiza aquí */
import { useEffect, useState } from "react";
import { formatBs } from "@/lib/utils";

/**
 * Partes de la página de Subastas: pestañas, próximas subastas (con aviso de apertura),
 * historial de subastas cerradas (RF-16) y "Cómo funciona". Datos de demostración hasta
 * que las subastas se publiquen desde el panel con Supabase.
 */

export type Pestana = "vivo" | "proximas" | "cerradas";

const PROXIMAS = [
  {
    id: "p1",
    titulo: "Typica Villa Serrano — Cosecha temprana",
    origen: "Villa Serrano, Chuquisaca · 1.900 msnm · 12 kg",
    texto: "Cerezas recogidas a mano en la primera pasada de la cosecha, proceso lavado.",
    salida: 380,
    abreEnSeg: 2 * 86400 + 5 * 3600,
    img: "/images/subastas/cosecha.webp",
    alt: "Canasta de mimbre con cerezas de café rojas y amarillas entre los cafetos",
  },
  {
    id: "p2",
    titulo: "Caturra Padilla — Honey amarillo",
    origen: "Padilla, Chuquisaca · 1.720 msnm · 15 kg",
    texto: "Secado lento en pergamino durante tres semanas. Dulzor de panela y durazno.",
    salida: 300,
    abreEnSeg: 5 * 86400 + 2 * 3600,
    img: "/images/subastas/pergamino.webp",
    alt: "Café en pergamino extendido en una cama de secado con un rastrillo de madera",
  },
];

const CERRADAS = [
  {
    id: "c1",
    titulo: "Gesha Villa Serrano — Lote 2024",
    origen: "Villa Serrano, Chuquisaca · 8 kg",
    ganador: "Café Mirador SCZ",
    final: 920,
    salida: 450,
    pujas: 14,
    fecha: "18 de septiembre de 2025",
    img: "/images/subastas/catacion.webp",
    alt: "Taza de catación con una cuchara rompiendo la costra del café molido",
  },
  {
    id: "c2",
    titulo: "Bourbon rojo Padilla — Natural",
    origen: "Padilla, Chuquisaca · 20 kg",
    ganador: "Roasters del Sur",
    final: 540,
    salida: 260,
    pujas: 11,
    fecha: "2 de septiembre de 2025",
    img: "/images/subastas/entrega.webp",
    alt: "Saco pequeño de café verde con una etiqueta, listo para enviar junto a una caja",
  },
];

function cuenta(seg: number) {
  const d = Math.floor(seg / 86400);
  const h = Math.floor((seg % 86400) / 3600);
  const m = Math.floor((seg % 3600) / 60);
  return d > 0 ? `${d} d ${h} h ${String(m).padStart(2, "0")} min` : `${h} h ${String(m).padStart(2, "0")} min`;
}

export function Pestanas({
  pestana,
  setPestana,
  enVivo,
}: {
  pestana: Pestana;
  setPestana: (p: Pestana) => void;
  enVivo: number;
}) {
  const items: { id: Pestana; label: string; n: number }[] = [
    { id: "vivo", label: "En vivo", n: enVivo },
    { id: "proximas", label: "Próximas", n: PROXIMAS.length },
    { id: "cerradas", label: "Cerradas", n: CERRADAS.length },
  ];
  return (
    <div className="categorias subastas__pestanas" role="tablist" aria-label="Subastas" data-revelar>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="tab"
          aria-selected={pestana === it.id}
          className={`categoria${pestana === it.id ? " is-on" : ""}`}
          onClick={() => setPestana(it.id)}
        >
          {it.id === "vivo" && <span className="en-vivo" aria-hidden="true" />} {it.label} <span>{it.n}</span>
        </button>
      ))}
    </div>
  );
}

export function Proximas() {
  const [pasados, setPasados] = useState(0);
  const [avisar, setAvisar] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const id = setInterval(() => setPasados((s) => s + 30), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="lotes" role="tabpanel" aria-label="Próximas subastas">
      {PROXIMAS.map((p) => (
        <article key={p.id} className="lote">
          <div className="lote__visual">
            <img src={p.img} alt={p.alt} loading="lazy" decoding="async" />
            <span className="lote__reloj">Abre en {cuenta(Math.max(0, p.abreEnSeg - pasados))}</span>
          </div>
          <div className="lote__cuerpo">
            <p className="lote__origen">{p.origen}</p>
            <h2 className="lote__titulo">{p.titulo}</h2>
            <p className="lote__desc">{p.texto}</p>
            <div className="lote__puja">
              <div>
                <span className="lote__etiqueta">Precio de salida</span>
                <span className="lote__monto">{formatBs(p.salida)}</span>
              </div>
            </div>
            <button
              type="button"
              className={`btn ${avisar[p.id] ? "btn--secondary" : "btn--primary"} lote__avisar`}
              aria-pressed={!!avisar[p.id]}
              onClick={() => setAvisar((a) => ({ ...a, [p.id]: !a[p.id] }))}
            >
              {avisar[p.id] ? "Te avisaremos cuando abra ✓" : "Avisarme cuando abra"}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

export function Cerradas() {
  return (
    <div className="lotes" role="tabpanel" aria-label="Subastas cerradas">
      {CERRADAS.map((c) => (
        <article key={c.id} className="lote">
          <div className="lote__visual">
            <img src={c.img} alt={c.alt} loading="lazy" decoding="async" />
            <span className="lote__reloj">Cerró el {c.fecha}</span>
          </div>
          <div className="lote__cuerpo">
            <p className="lote__origen">{c.origen}</p>
            <h2 className="lote__titulo">{c.titulo}</h2>
            <div className="lote__puja">
              <div>
                <span className="lote__etiqueta">Precio final</span>
                <span className="lote__monto">{formatBs(c.final)}</span>
              </div>
              <div className="lote__lider">
                <span className="lote__etiqueta">{c.pujas} pujas</span>
                <span>+{Math.round((c.final / c.salida - 1) * 100)} % sobre la salida</span>
              </div>
            </div>
            <p className="lote__resultado">Ganó {c.ganador}. Salió en {formatBs(c.salida)}.</p>
          </div>
        </article>
      ))}
    </div>
  );
}

export function ComoFunciona() {
  const pasos = [
    ["Regístrate", "Crea tu cuenta para pujar. Puedes ser una cafetería, un tostador o un amante del café."],
    ["Puja", "Cada puja debe superar a la anterior en al menos Bs. 20. Ves en vivo quién va primero."],
    ["Te avisamos", "Si alguien te supera, te avisamos al momento para que decidas si vuelves a pujar."],
    ["Ganas y pagas", "Al cerrar, gana la puja más alta. Generamos tu orden de compra y coordinamos el envío."],
  ];
  return (
    <section className="section" aria-labelledby="sub-como-titulo">
      <div className="wrap">
        <div className="head" data-revelar>
          <h2 id="sub-como-titulo">Cómo funciona una subasta</h2>
          <div>
            <p>Lotes pequeños y únicos: cuando se venden, no vuelven a la tienda.</p>
          </div>
        </div>
        <ol className="pasos pasos--4">
          {pasos.map(([t, d], i) => (
            <li key={t} className={`paso ${i % 2 ? "desde-der" : "desde-izq"}`} data-revelar style={{ "--i": i } as React.CSSProperties}>
              <span className="paso__num">0{i + 1}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
