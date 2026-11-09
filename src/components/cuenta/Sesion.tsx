"use client";

import { useEffect } from "react";
import { useAuth } from "@/store/authStore";
import VentanaCuenta from "./VentanaCuenta";

/** Arranca la sesión de Supabase y monta la ventana de cuenta (una vez por layout). */
export default function Sesion() {
  const iniciar = useAuth((s) => s.iniciar);
  useEffect(() => iniciar(), [iniciar]);
  return <VentanaCuenta />;
}
