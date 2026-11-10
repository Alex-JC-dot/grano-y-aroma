/**
 * Generador de archivos Excel (.xlsx) sin dependencias.
 *
 * ¿Por qué a mano y no con una librería?
 *
 * Las dos opciones habituales no encajan en este proyecto. SheetJS deja el formato de
 * celdas detrás de su edición Pro, que es de pago, y la sección 4.3 del documento de visión
 * excluye licencias comerciales. ExcelJS es MIT pero arrastra 98 paquetes —varios ya
 * descontinuados— y unos 600 KB, que chocan con RNF-11.
 *
 * Un .xlsx es un ZIP con archivos XML dentro. Para lo que necesitamos —encabezados con
 * estilo, formato de moneda en bolivianos, anchos de columna, fila congelada y filtros— eso
 * cabe en este archivo. El ZIP se arma con entradas "stored", es decir sin comprimir, que
 * evita necesitar un compresor: Excel las acepta igual.
 *
 * Lo importante de verdad: los números salen como NÚMEROS, con su formato aplicado por
 * Excel. Si salieran como texto, el docente no podría sumar una columna y el reporte no
 * serviría para nada.
 */

export type FormatoCelda = "texto" | "moneda" | "numero" | "entero" | "fecha" | "porcentaje";

export interface ColumnaExcel {
  /** Encabezado visible de la columna. */
  titulo: string;
  /** Clave con la que se lee el valor en cada fila. */
  clave: string;
  /** Ancho en caracteres. Si se omite, se calcula a partir del contenido. */
  ancho?: number;
  formato?: FormatoCelda;
}

export interface HojaExcel {
  /** Nombre de la pestaña. Excel no admite : \ / ? * [ ] ni más de 31 caracteres. */
  nombre: string;
  columnas: ColumnaExcel[];
  filas: Record<string, string | number | Date | null | undefined>[];
}

// ─────────────────────────────── ZIP ───────────────────────────────

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(datos: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < datos.length; i++) c = TABLA_CRC[(c ^ datos[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

interface EntradaZip {
  nombre: string;
  datos: Uint8Array;
}

/** Arma un ZIP con entradas sin comprimir. */
function crearZip(entradas: EntradaZip[]): Blob {
  const utf8 = new TextEncoder();
  const locales: Uint8Array[] = [];
  const centrales: Uint8Array[] = [];
  let desplazamiento = 0;

  for (const entrada of entradas) {
    const nombre = utf8.encode(entrada.nombre);
    const crc = crc32(entrada.datos);
    const tam = entrada.datos.length;

    const local = new Uint8Array(30 + nombre.length);
    const vl = new DataView(local.buffer);
    vl.setUint32(0, 0x04034b50, true); // firma
    vl.setUint16(4, 20, true); // versión necesaria
    vl.setUint16(6, 0x0800, true); // bandera: nombres en UTF-8
    vl.setUint16(8, 0, true); // método 0 = sin comprimir
    vl.setUint16(10, 0, true); // hora
    vl.setUint16(12, 0x21, true); // fecha (1 de enero de 1980)
    vl.setUint32(14, crc, true);
    vl.setUint32(18, tam, true);
    vl.setUint32(22, tam, true);
    vl.setUint16(26, nombre.length, true);
    vl.setUint16(28, 0, true);
    local.set(nombre, 30);

    const central = new Uint8Array(46 + nombre.length);
    const vc = new DataView(central.buffer);
    vc.setUint32(0, 0x02014b50, true);
    vc.setUint16(4, 20, true); // versión que lo creó
    vc.setUint16(6, 20, true);
    vc.setUint16(8, 0x0800, true);
    vc.setUint16(10, 0, true);
    vc.setUint16(12, 0, true);
    vc.setUint16(14, 0x21, true);
    vc.setUint32(16, crc, true);
    vc.setUint32(20, tam, true);
    vc.setUint32(24, tam, true);
    vc.setUint16(28, nombre.length, true);
    vc.setUint32(42, desplazamiento, true);
    central.set(nombre, 46);

    locales.push(local, entrada.datos);
    centrales.push(central);
    desplazamiento += local.length + tam;
  }

  const tamCentral = centrales.reduce((s, c) => s + c.length, 0);
  const fin = new Uint8Array(22);
  const vf = new DataView(fin.buffer);
  vf.setUint32(0, 0x06054b50, true);
  vf.setUint16(8, entradas.length, true);
  vf.setUint16(10, entradas.length, true);
  vf.setUint32(12, tamCentral, true);
  vf.setUint32(16, desplazamiento, true);

  // Un único búfer en vez de pasarle a Blob una lista de vistas: evita que el tipo del
  // ArrayBuffer subyacente tenga que viajar hasta la firma de Blob, y copia una sola vez.
  const partes = [...locales, ...centrales, fin];
  const total = partes.reduce((s, p) => s + p.length, 0);
  const archivo = new Uint8Array(total);
  let pos = 0;
  for (const parte of partes) {
    archivo.set(parte, pos);
    pos += parte.length;
  }

  return new Blob([archivo.buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

// ─────────────────────────────── XML ───────────────────────────────

function escapar(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Excel cuenta los días desde el 30 de diciembre de 1899. */
function fechaASerie(d: Date): number {
  const utc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((utc - Date.UTC(1899, 11, 30)) / 86_400_000);
}

/** Columna 1 → "A", 27 → "AA". */
function letraColumna(n: number): string {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Índices de estilo definidos en estilos(): el orden de cellXfs manda.
 * 1 encabezado · 2 texto · 3 moneda · 4 número · 5 entero · 6 fecha · 7 porcentaje
 */
const ESTILO: Record<FormatoCelda, number> = {
  texto: 2,
  moneda: 3,
  numero: 4,
  entero: 5,
  fecha: 6,
  porcentaje: 7,
};

function estilos(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="5">
<numFmt numFmtId="164" formatCode="&quot;Bs&quot;\\ #,##0.00"/>
<numFmt numFmtId="165" formatCode="#,##0.00"/>
<numFmt numFmtId="166" formatCode="#,##0"/>
<numFmt numFmtId="167" formatCode="dd/mm/yyyy"/>
<numFmt numFmtId="168" formatCode="0.0%"/>
</numFmts>
<fonts count="2">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF4A2E1B"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left/><right/><top/><bottom style="thin"><color rgb="FFD8D2CB"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="8">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="167" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="168" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function hojaXml(hoja: HojaExcel): string {
  const cols = hoja.columnas;

  const anchos = cols
    .map((c, i) => {
      if (c.ancho) return { i: i + 1, ancho: c.ancho };
      // Una fecha ocupa "dd/mm/aaaa" en pantalla, no el texto largo del objeto Date.
      if (c.formato === "fecha") return { i: i + 1, ancho: Math.max(c.titulo.length + 3, 13) };
      // Ancho automático: el texto más largo de la columna, con un mínimo y un máximo.
      const largos = hoja.filas.map((f) => String(f[c.clave] ?? "").length);
      const max = Math.max(c.titulo.length, ...largos, 8);
      return { i: i + 1, ancho: Math.min(max + 3, 42) };
    })
    .map((a) => `<col min="${a.i}" max="${a.i}" width="${a.ancho}" customWidth="1"/>`)
    .join("");

  const encabezado =
    `<row r="1" ht="22" customHeight="1">` +
    cols.map((c, i) => `<c r="${letraColumna(i + 1)}1" s="1" t="inlineStr"><is><t>${escapar(c.titulo)}</t></is></c>`).join("") +
    `</row>`;

  const filas = hoja.filas
    .map((fila, indice) => {
      const r = indice + 2;
      const celdas = cols
        .map((c, i) => {
          const ref = `${letraColumna(i + 1)}${r}`;
          const valor = fila[c.clave];
          const formato: FormatoCelda = c.formato ?? "texto";
          const s = ESTILO[formato];

          if (valor === null || valor === undefined || valor === "") return `<c r="${ref}" s="${s}"/>`;

          if (valor instanceof Date) return `<c r="${ref}" s="${ESTILO.fecha}"><v>${fechaASerie(valor)}</v></c>`;

          if (typeof valor === "number" && formato !== "texto") {
            return Number.isFinite(valor) ? `<c r="${ref}" s="${s}"><v>${valor}</v></c>` : `<c r="${ref}" s="${s}"/>`;
          }

          return `<c r="${ref}" s="${s}" t="inlineStr"><is><t>${escapar(String(valor))}</t></is></c>`;
        })
        .join("");
      return `<row r="${r}">${celdas}</row>`;
    })
    .join("");

  const ultima = `${letraColumna(cols.length)}${hoja.filas.length + 1}`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${anchos}</cols>
<sheetData>${encabezado}${filas}</sheetData>
<autoFilter ref="A1:${ultima}"/>
</worksheet>`;
}

/** Excel rechaza : \ / ? * [ ] en los nombres de pestaña, y corta en 31 caracteres. */
function nombreHojaValido(nombre: string, indice: number): string {
  const limpio = nombre.replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 31);
  return limpio || `Hoja${indice + 1}`;
}

/** Construye el archivo .xlsx completo. */
export function generarXlsx(hojas: HojaExcel[]): Blob {
  if (hojas.length === 0) throw new Error("Un libro de Excel necesita al menos una hoja.");

  const utf8 = new TextEncoder();
  const nombres = hojas.map((h, i) => nombreHojaValido(h.nombre, i));

  const tiposContenido =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    hojas
      .map(
        (_, i) =>
          `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
      )
      .join("") +
    `</Types>`;

  const relsRaiz =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;

  const libro =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>` +
    nombres.map((n, i) => `<sheet name="${escapar(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
    `</sheets></workbook>`;

  const relsLibro =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    hojas
      .map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
      )
      .join("") +
    `<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `</Relationships>`;

  const entradas: EntradaZip[] = [
    { nombre: "[Content_Types].xml", datos: utf8.encode(tiposContenido) },
    { nombre: "_rels/.rels", datos: utf8.encode(relsRaiz) },
    { nombre: "xl/workbook.xml", datos: utf8.encode(libro) },
    { nombre: "xl/_rels/workbook.xml.rels", datos: utf8.encode(relsLibro) },
    { nombre: "xl/styles.xml", datos: utf8.encode(estilos()) },
    ...hojas.map((h, i) => ({ nombre: `xl/worksheets/sheet${i + 1}.xml`, datos: utf8.encode(hojaXml(h)) })),
  ];

  return crearZip(entradas);
}
