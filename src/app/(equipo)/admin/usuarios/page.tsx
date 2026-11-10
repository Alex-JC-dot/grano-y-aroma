"use client";

import { useCallback, useEffect, useState } from "react";
import { mensajeDeError, supabase, type Rol } from "@/lib/supabase";
import { useAuth } from "@/store/authStore";

/**
 * Usuarios y roles (RF-36): el admin ve todas las cuentas y les cambia el rol. La base solo
 * permite cambiar roles al admin (trigger proteger_rol + RLS); usuarios_admin() trae el correo.
 * Las cuentas nuevas del equipo se crean registrándose en la web o en Supabase → Authentication.
 */

type Usuario = { id: string; email: string; nombre: string; rol: Rol; puntos: number; creado_en: string };

const ROLES: { v: Rol; label: string; detalle: string }[] = [
  { v: "cliente", label: "Cliente", detalle: "Compra, se suscribe y puja" },
  { v: "cajero", label: "Cajero", detalle: "Caja de la cafetería" },
  { v: "tostador", label: "Tostador", detalle: "Bodega y tueste" },
  { v: "admin", label: "Administrador", detalle: "Todo" },
];

export default function PaginaUsuarios() {
  const yo = useAuth((s) => s.session?.user.id);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.rpc("usuarios_admin");
    if (error) setAviso(mensajeDeError(error));
    setUsuarios((data as Usuario[]) ?? []);
    setCargando(false);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(cargar, 0);
    return () => window.clearTimeout(t);
  }, [cargar]);

  const cambiarRol = async (u: Usuario, rol: Rol) => {
    if (u.id === yo && rol !== "admin" && !window.confirm("Vas a quitarte el rol de administrador y perderás acceso a este panel. ¿Seguro?")) return;
    setGuardando(u.id);
    const { error } = await supabase.from("perfiles").update({ rol }).eq("id", u.id);
    setGuardando(null);
    if (error) return setAviso(mensajeDeError(error));
    setUsuarios((xs) => xs.map((x) => (x.id === u.id ? { ...x, rol } : x)));
    setAviso(`${u.nombre || u.email} ahora es ${ROLES.find((r) => r.v === rol)!.label.toLowerCase()}.`);
  };

  const q = busqueda.trim().toLowerCase();
  const visibles = usuarios.filter((u) => !q || u.email.toLowerCase().includes(q) || u.nombre.toLowerCase().includes(q));

  return (
    <div className="equipo__pagina">
      <div className="equipo__cabeza">
        <div>
          <p className="eyebrow">Administración</p>
          <h1>Usuarios y roles</h1>
        </div>
      </div>

      <div className="tarjetas-dato tarjetas-dato--4">
        {ROLES.map((r) => (
          <div key={r.v} className="dato">
            <span className="dato__label">{r.label}</span>
            <strong className="dato__valor">{usuarios.filter((u) => u.rol === r.v).length}</strong>
            <span className="dato__nota">{r.detalle}</span>
          </div>
        ))}
      </div>

      <div className="equipo__acciones">
        <div className="carrito__campo" style={{ minWidth: 280 }}>
          <label htmlFor="u-buscar">Buscar por nombre o correo</label>
          <input id="u-buscar" type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
        <p className="equipo__aviso" role="status">{aviso}</p>
      </div>

      {cargando ? (
        <p className="caja__vacia" aria-busy="true">Cargando usuarios…</p>
      ) : (
        <div className="tabla-marco">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Usuario</th>
                <th scope="col" className="num">Puntos</th>
                <th scope="col">Desde</th>
                <th scope="col">Rol</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.nombre || "Sin nombre"}
                    {u.id === yo && " (tú)"}
                    <small>{u.email}</small>
                  </td>
                  <td className="num">{u.puntos}</td>
                  <td>{new Date(u.creado_en).toLocaleDateString("es-BO", { day: "numeric", month: "short", year: "numeric" })}</td>
                  <td>
                    <select
                      className="tueste-form__select admin-usu__rol"
                      aria-label={`Rol de ${u.nombre || u.email}`}
                      value={u.rol}
                      disabled={guardando === u.id}
                      onChange={(e) => cambiarRol(u, e.target.value as Rol)}
                    >
                      {ROLES.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="caja__sub" style={{ marginTop: 16 }}>
        Para sumar a alguien al equipo: que cree su cuenta en la web (botón Entrar) y aquí le cambias el rol.
      </p>
    </div>
  );
}
