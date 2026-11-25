/**
 * Código de un lote de café verde: PREFIJO-AÑO-GRN-NÚMERO (VS-2026-GRN-013). Se arma solo con el
 * lugar de donde viene y el número que sigue, para que nadie lo escriba a mano ni lo repita. El
 * lote tostado hereda el prefijo: lo genera la base al registrar el tueste (migración 007).
 */

const CONOCIDOS: [RegExp, string][] = [
  [/villa serrano/, "VS"],
  [/padilla/, "PAD"],
  [/caranavi/, "CAR"],
  [/coroico/, "COR"],
];
const SOBRAN = new Set(["cafe", "verde", "de", "del", "la", "las", "el", "los", "y", "lote", "finca", "grano"]);

/** El primero de los textos que diga algo: lugar conocido, iniciales (dos palabras) o tres letras. */
function prefijo(textos: string[]) {
  const limpios = textos.map((t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  for (const t of limpios) for (const [lugar, p] of CONOCIDOS) if (lugar.test(t)) return p;
  for (const t of limpios) {
    // "Irupana, Yungas" → Irupana
    const palabras = t.split(",")[0].replace(/[^a-z ]/g, " ").split(/\s+/).filter((x) => x && !SOBRAN.has(x));
    if (!palabras.length) continue;
    const p = (palabras.length > 1 ? palabras.slice(0, 3).map((x) => x[0]).join("") : palabras[0].slice(0, 3)).toUpperCase();
    if (p.length >= 2) return p;
  }
  return "";
}

/** El código que sigue; vacío mientras no se sepa de dónde viene el café. */
export function codigoLote(textos: string[], usados: string[], anio: number) {
  const p = prefijo(textos);
  if (!p) return "";
  const mayor = Math.max(0, ...usados.map((c) => Number(new RegExp(`^${p}-\\d{4}-GRN-(\\d+)$`).exec(c)?.[1] ?? 0)));
  return `${p}-${anio}-GRN-${String(mayor + 1).padStart(3, "0")}`;
}
