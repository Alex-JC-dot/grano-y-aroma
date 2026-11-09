"use client";

import { usePathname } from "next/navigation";

/** Ruta actual sin la barra final ("/tienda/" → "/tienda"), para comparar igual en local y en Render. */
export function useRuta() {
  const r = usePathname() || "/";
  return r.length > 1 ? r.replace(/\/+$/, "") : r;
}
