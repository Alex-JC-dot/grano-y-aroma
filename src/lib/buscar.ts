const limpio = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

/** ¿El texto tiene todas las palabras buscadas? Sin importar mayúsculas, tildes ni el orden. */
export const coincide = (texto: string, busqueda: string) => {
  const t = limpio(texto);
  return limpio(busqueda).split(/\s+/).every((p) => t.includes(p));
};
