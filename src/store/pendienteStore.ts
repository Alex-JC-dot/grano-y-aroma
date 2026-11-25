import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/store/authStore";

/** Lo que queda registrado al confirmar: el carrito se vacía enseguida. */
export type Comprobante = {
  id: number;
  /** Pago por QR: se confirma solo cuando el cliente escanea el código. */
  porQr: boolean;
  /** Falso solo mientras se espera que escaneen el QR. */
  pagado: boolean;
  /** Pasaron los 30 minutos (o se canceló): ya no se puede pagar. */
  vencido?: boolean;
  /** Últimos dígitos, si pagó con tarjeta. */
  tarjeta: string;
  numero: string;
  fecha: string;
  lineas: { nombre: string; detalle: string; cantidad: number; precio: number }[];
  /** Lo que sumaron los productos, antes del canje. */
  subtotal: number;
  descuento: number;
  puntosUsados: number;
  puntosGanados: number;
  /** Lo que el cliente paga de verdad: subtotal menos descuento. */
  total: number;
  metodo: string;
  cliente: { nombre: string; telefono: string; direccion: string; referencia: string };
};

/** La base cancela los pedidos sin pagar a los 30 minutos (migración 024). */
export const MINUTOS_PARA_PAGAR = 30;

export const fechaComprobante = (d: Date) => d.toLocaleDateString("es-BO", { day: "numeric", month: "long", year: "numeric" });

type Fila = {
  id: number;
  codigo: string;
  total: number;
  descuento: number | null;
  puntos_usados: number | null;
  puntos_ganados: number | null;
  nombre: string | null;
  telefono: string | null;
  direccion: string | null;
  referencia: string | null;
  creado_en: string;
  pedido_items: { cantidad: number; precio: number; molienda: string | null; productos: { nombre: string; presentacion: string | null } | null }[];
};

/**
 * El pedido de la tienda que espera el pago por QR. Se lee de la base, no del navegador: así el QR
 * vuelve a salir aunque se cierre el carrito, se recargue la página o se entre desde otro equipo.
 */
export const usePendiente = create<{
  pedido: Comprobante | null;
  cargar: () => Promise<void>;
  guardar: (p: Comprobante | null) => void;
}>((set) => ({
  pedido: null,
  guardar: (pedido) => set({ pedido }),
  cargar: async () => {
    const uid = useAuth.getState().session?.user.id;
    if (!uid) return set({ pedido: null });
    const { data, error } = await supabase
      .from("pedidos")
      .select("id, codigo, total, descuento, puntos_usados, puntos_ganados, nombre, telefono, direccion, referencia, creado_en, pedido_items(cantidad, precio, molienda, productos(nombre, presentacion))")
      .eq("cliente_id", uid)
      .eq("canal", "web")
      .eq("metodo_pago", "qr")
      .eq("pago_estado", "pendiente")
      .eq("estado", "recibido")
      .gte("creado_en", new Date(Date.now() - MINUTOS_PARA_PAGAR * 60000).toISOString())
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return; // sin internet se queda lo que había
    const f = data as unknown as Fila | null;
    if (!f) return set({ pedido: null });
    set({
      pedido: {
        id: f.id,
        porQr: true,
        pagado: false,
        tarjeta: "",
        numero: f.codigo,
        fecha: fechaComprobante(new Date(f.creado_en)),
        lineas: f.pedido_items.map((i) => ({
          nombre: i.productos?.nombre ?? "Producto",
          detalle: !i.molienda || i.molienda === "Única" ? (i.productos?.presentacion ?? "") : i.molienda,
          cantidad: i.cantidad,
          precio: Number(i.precio),
        })),
        subtotal: Number(f.total) + Number(f.descuento ?? 0),
        descuento: Number(f.descuento ?? 0),
        puntosUsados: f.puntos_usados ?? 0,
        puntosGanados: f.puntos_ganados ?? 0,
        total: Number(f.total),
        metodo: "QR Bolivia",
        cliente: { nombre: f.nombre ?? "", telefono: f.telefono ?? "", direccion: f.direccion ?? "", referencia: f.referencia ?? "" },
      },
    });
  },
}));
