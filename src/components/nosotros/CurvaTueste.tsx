/**
 * Curva de tueste (temperatura del grano contra tiempo) de un tueste medio, con sus etapas.
 * La línea se dibuja sola cuando la sección aparece (RevelarAlScroll + CSS) y los hitos
 * aparecen en orden. Valores de referencia de un tueste medio de 13 minutos, como el lote
 * PAD-2025-WAS-003 del registro de tueste (205 °C pico).
 */

// [minuto, °C]
const PUNTOS: [number, number][] = [
  [0, 200], [0.5, 140], [1, 102], [1.25, 96], [2, 108], [3, 128], [4, 146], [4.5, 154],
  [5, 160], [6, 170], [7, 178], [8, 186], [9, 192], [9.5, 196], [10, 198], [11, 201], [12, 203.5], [13, 205],
];

const HITOS = [
  { t: 1.25, temp: 96, titulo: "Punto de retorno", texto: "El grano frío absorbe el calor y la temperatura deja de bajar." },
  { t: 4.5, temp: 154, titulo: "Fin del secado", texto: "El grano pierde su humedad y pasa de verde a amarillo." },
  { t: 9.5, temp: 196, titulo: "Primer crack", texto: "El grano se abre con un chasquido: empieza el desarrollo del sabor." },
  { t: 13, temp: 205, titulo: "Descarga", texto: "Sale a la bandeja de enfriado para detener el tueste en el punto justo." },
];

// Área de dibujo
const W = 800;
const H = 380;
const M = { izq: 56, der: 24, arr: 20, aba: 44 };
const T_MAX = 13;
const C_MIN = 80;
const C_MAX = 220;
const x = (t: number) => M.izq + (t / T_MAX) * (W - M.izq - M.der);
const y = (c: number) => M.arr + (1 - (c - C_MIN) / (C_MAX - C_MIN)) * (H - M.arr - M.aba);

// Curva suave (Catmull-Rom → Bézier)
function camino(pts: [number, number][]) {
  const p = pts.map(([t, c]) => [x(t), y(c)]);
  let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i];
    const [p1, p2] = [p[i], p[i + 1]];
    const p3 = p[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}
const D = camino(PUNTOS);

export default function CurvaTueste() {
  return (
    <section className="section" id="curva" aria-labelledby="curva-titulo">
      <div className="wrap">
        <div className="head" data-revelar>
          <h2 id="curva-titulo">La curva de cada tueste</h2>
          <div>
            <p>
              Medimos la temperatura del grano durante todo el tueste. Esta es la curva de un tueste medio de 13
              minutos; cada lote guarda la suya.
            </p>
          </div>
        </div>

        <div className="curva" data-revelar>
          <figure className="curva__grafico">
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="curva-desc">
              <desc id="curva-desc">
                La temperatura del grano baja de 200 a 96 °C en el primer minuto, sube hasta 154 °C a los 4:30 (fin del
                secado), llega a 196 °C a los 9:30 (primer crack) y termina en 205 °C a los 13 minutos.
              </desc>
              {/* Etapas de fondo */}
              <rect x={x(0)} y={M.arr} width={x(4.5) - x(0)} height={H - M.arr - M.aba} className="curva__etapa curva__etapa--1" />
              <rect x={x(4.5)} y={M.arr} width={x(9.5) - x(4.5)} height={H - M.arr - M.aba} className="curva__etapa curva__etapa--2" />
              <rect x={x(9.5)} y={M.arr} width={x(13) - x(9.5)} height={H - M.arr - M.aba} className="curva__etapa curva__etapa--3" />
              <text x={(x(0) + x(4.5)) / 2} y={H - M.aba - 12} className="curva__etiqueta-etapa">Secado</text>
              <text x={(x(4.5) + x(9.5)) / 2} y={H - M.aba - 12} className="curva__etiqueta-etapa">Maillard</text>
              <text x={(x(9.5) + x(13)) / 2} y={H - M.aba - 12} className="curva__etiqueta-etapa">Desarrollo</text>

              {/* Ejes */}
              {[100, 140, 180, 220].map((c) => (
                <g key={c}>
                  <line x1={M.izq} x2={W - M.der} y1={y(c)} y2={y(c)} className="curva__guia" />
                  <text x={M.izq - 10} y={y(c) + 4} className="curva__eje" textAnchor="end">{c} °C</text>
                </g>
              ))}
              {[0, 3, 6, 9, 13].map((t) => (
                <text key={t} x={x(t)} y={H - M.aba + 24} className="curva__eje" textAnchor="middle">{t} min</text>
              ))}

              {/* La curva */}
              <path d={D} pathLength={1} className="curva__linea" />

              {/* Hitos */}
              {HITOS.map((h, i) => (
                <g key={h.titulo} className="curva__hito" style={{ "--i": i } as React.CSSProperties}>
                  <circle cx={x(h.t)} cy={y(h.temp)} r={7} />
                  <text x={x(h.t)} y={y(h.temp) - 16} textAnchor={i === HITOS.length - 1 ? "end" : "middle"}>
                    {i + 1}
                  </text>
                </g>
              ))}
            </svg>
          </figure>

          <ol className="curva__hitos">
            {HITOS.map((h, i) => (
              <li key={h.titulo} style={{ "--i": i } as React.CSSProperties}>
                <span className="curva__num">{i + 1}</span>
                <div>
                  <h3>
                    {h.titulo} <small>{Math.floor(h.t)}:{String(Math.round((h.t % 1) * 60)).padStart(2, "0")} · {h.temp} °C</small>
                  </h3>
                  <p>{h.texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
