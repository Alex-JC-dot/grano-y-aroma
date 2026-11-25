"use client";

/** El buscador de los paneles: escribe y la lista se filtra al instante. Escape lo limpia. */
export default function Buscador({
  valor,
  alCambiar,
  etiqueta,
  ejemplo,
  alEnter,
}: {
  valor: string;
  alCambiar: (v: string) => void;
  etiqueta: string;
  ejemplo?: string;
  /** Enter: en la Caja agrega el primer resultado. */
  alEnter?: () => void;
}) {
  return (
    <div className="buscador" role="search">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4.5 4.5" />
      </svg>
      <input
        type="text"
        inputMode="search"
        autoComplete="off"
        spellCheck={false}
        aria-label={etiqueta}
        placeholder={ejemplo ?? etiqueta}
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") alCambiar("");
          if (e.key === "Enter" && valor.trim()) {
            e.preventDefault();
            alEnter?.();
          }
        }}
      />
      {valor && (
        <button type="button" aria-label="Borrar la búsqueda" onClick={() => alCambiar("")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      )}
    </div>
  );
}
