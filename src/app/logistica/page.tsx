"use client";

import { useState } from "react";
import Navbar from "@/components/layout/Navbar";
import CartDrawer from "@/components/home/CartDrawer";
import { orders as initialOrders } from "@/lib/data";
import { Order } from "@/lib/types";
import { formatBs } from "@/lib/utils";
import { MapPin, Truck, CheckCircle, Clock, Package, User } from "lucide-react";

const statusSteps: Order["status"][] = ["Recibido", "En Preparación", "En Camino", "Entregado"];
const statusIcons: Record<string, React.ReactNode> = {
  "Recibido": <Clock size={14} />,
  "En Preparación": <Package size={14} />,
  "En Camino": <Truck size={14} />,
  "Entregado": <CheckCircle size={14} />,
};
const statusClass: Record<string, string> = {
  "Recibido": "status-recibido",
  "En Preparación": "status-preparacion",
  "En Camino": "status-camino",
  "Entregado": "status-entregado",
};

export default function LogisticaPage() {
  const [orders, setOrders] = useState(initialOrders);
  const [selected, setSelected] = useState<Order | null>(null);

  const advance = (id: string) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        const idx = statusSteps.indexOf(o.status);
        if (idx < statusSteps.length - 1) return { ...o, status: statusSteps[idx + 1] };
        return o;
      })
    );
    setSelected((s) => {
      if (!s || s.id !== id) return s;
      const idx = statusSteps.indexOf(s.status);
      if (idx < statusSteps.length - 1) return { ...s, status: statusSteps[idx + 1] };
      return s;
    });
  };

  return (
    <main className="min-h-screen bg-[#1A0F0B]">
      <Navbar />
      <CartDrawer />

      <div className="pt-36 md:pt-44 pb-32 px-6 sm:px-10 lg:px-16 xl:px-20 max-w-7xl mx-auto">
        <div className="mb-12">
          <p className="text-[0.68rem] text-[#C89D54] uppercase tracking-[3px] font-semibold mb-3">Logística & Envíos</p>
          <h1 className="font-serif text-4xl sm:text-5xl text-white font-bold">Seguimiento de Entregas</h1>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
          {statusSteps.map((s) => (
            <div key={s} className="p-4 rounded-2xl border border-white/8 bg-[#2C1A14]/40">
              <div className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full mb-2 ${statusClass[s]}`}>
                {statusIcons[s]}{s}
              </div>
              <p className="text-white text-2xl font-bold">{orders.filter((o) => o.status === s).length}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Order list */}
          <div className="lg:col-span-2 space-y-3">
            {orders.map((order) => (
              <div
                key={order.id}
                onClick={() => setSelected(order)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  selected?.id === order.id
                    ? "border-[#C89D54]/50 bg-[#C89D54]/8"
                    : "border-white/8 bg-[#2C1A14]/30 hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[#C89D54] text-xs font-bold">{order.id}</span>
                  <span className={`text-[0.6rem] px-2 py-1 rounded-full ${statusClass[order.status]}`}>{order.status}</span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <User size={12} className="text-white/40" />
                  <span className="text-white text-sm font-medium">{order.customer}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin size={12} className="text-white/30" />
                  <span className="text-white/40 text-xs truncate">{order.address}</span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                  <span className="text-white/30 text-xs">Pedido: {order.createdAt}</span>
                  <span className="text-[#C89D54] font-semibold text-sm">{formatBs(order.total)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Order detail */}
          <div className="lg:col-span-3">
            {selected ? (
              <div className="p-6 rounded-2xl border border-white/10 bg-[#2C1A14]/40">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="font-serif text-2xl text-white font-bold">{selected.id}</h2>
                    <p className="text-white/40 text-xs">{selected.customer}</p>
                  </div>
                  <span className={`text-xs px-3 py-1.5 rounded-full ${statusClass[selected.status]}`}>{selected.status}</span>
                </div>

                {/* Progress bar */}
                <div className="relative mb-8">
                  <div className="flex justify-between items-center relative">
                    {statusSteps.map((step, i) => {
                      const activeIdx = statusSteps.indexOf(selected.status);
                      const done = i <= activeIdx;
                      return (
                        <div key={step} className="flex flex-col items-center flex-1">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all z-10 ${
                            done ? "bg-[#C89D54] border-[#C89D54] text-[#1A0F0B]" : "bg-[#1A0F0B] border-white/20 text-white/30"
                          }`}>
                            {statusIcons[step]}
                          </div>
                          <p className={`text-[0.6rem] mt-1 text-center leading-tight ${done ? "text-[#C89D54]" : "text-white/30"}`}>
                            {step}
                          </p>
                          {i < statusSteps.length - 1 && (
                            <div className={`absolute top-4 h-0.5 transition-all ${
                              i < activeIdx ? "bg-[#C89D54]" : "bg-white/10"
                            }`} style={{ left: `${(i / (statusSteps.length - 1)) * 100 + 100 / (statusSteps.length - 1) / 2}%`, width: `${100 / (statusSteps.length - 1)}%` }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/8">
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Items</p>
                    {selected.items.map((item) => (
                      <p key={item} className="text-white/70 text-sm">• {item}</p>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/8">
                      <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Dirección</p>
                      <p className="text-white text-sm">{selected.address}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/8">
                      <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Repartidor</p>
                      <p className="text-white text-sm">{selected.driver || "Sin asignar"}</p>
                    </div>
                  </div>
                </div>

                {selected.status !== "Entregado" && (
                  <button
                    onClick={() => advance(selected.id)}
                    className="w-full py-3.5 rounded-xl bg-[#C89D54] text-[#1A0F0B] font-bold text-sm hover:bg-[#D4A373] transition-all flex items-center justify-center gap-2"
                  >
                    <Truck size={16} />
                    Avanzar a "{statusSteps[statusSteps.indexOf(selected.status) + 1]}"
                  </button>
                )}
              </div>
            ) : (
              <div className="h-64 rounded-2xl border border-white/8 flex items-center justify-center">
                <p className="text-white/25 text-sm">Selecciona un pedido para ver detalles</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
