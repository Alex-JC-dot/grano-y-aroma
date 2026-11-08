"use client";

import { useState } from "react";
import Navbar from "@/components/layout/Navbar";
import CartDrawer from "@/components/home/CartDrawer";
import { posItems } from "@/lib/data";
import { POSItem } from "@/lib/types";
import { formatBs } from "@/lib/utils";
import { Plus, Minus, Trash2, Printer, CreditCard, Smartphone, Banknote, X } from "lucide-react";

type CartEntry = POSItem & { qty: number };
const categories = ["Todos", "Bebidas Calientes", "Bebidas Frías", "Métodos", "Pastelería", "Retail", "Otros"];

export default function POSPage() {
  const [cat, setCat] = useState("Todos");
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [payment, setPayment] = useState<"efectivo" | "qr" | "tarjeta">("efectivo");
  const [showCierre, setShowCierre] = useState(false);

  const filtered = posItems.filter((i) => cat === "Todos" || i.category === cat);
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const addToCart = (item: POSItem) => {
    setCart((c) => {
      const ex = c.find((x) => x.id === item.id);
      return ex ? c.map((x) => x.id === item.id ? { ...x, qty: x.qty + 1 } : x) : [...c, { ...item, qty: 1 }];
    });
  };
  const removeFromCart = (id: string) => setCart((c) => c.filter((x) => x.id !== id));
  const updateQty = (id: string, delta: number) => setCart((c) =>
    c.map((x) => x.id === id ? { ...x, qty: Math.max(0, x.qty + delta) } : x).filter((x) => x.qty > 0)
  );
  const handleSale = () => {
    alert(`✅ Venta de ${formatBs(total)} registrada.\nMétodo: ${payment === "efectivo" ? "Efectivo" : payment === "qr" ? "QR Bolivia" : "Tarjeta"}`);
    setCart([]);
  };

  const dailySales = [
    { method: "Efectivo", amount: 1240, count: 18 },
    { method: "QR Bolivia", amount: 890, count: 12 },
    { method: "Tarjeta", amount: 430, count: 5 },
  ];

  return (
    <main className="min-h-screen bg-[#1A0F0B] flex flex-col">
      <Navbar />
      <CartDrawer />

      <div className="flex flex-col md:flex-row flex-1 pt-20 h-screen overflow-hidden">
        {/* Left: Product Grid */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Category tabs */}
          <div className="flex gap-2 overflow-x-auto px-4 py-3 border-b border-white/8 scrollbar-none">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  cat === c ? "bg-[#C89D54] text-[#1A0F0B]" : "bg-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                {c}
              </button>
            ))}
            <button
              onClick={() => setShowCierre(true)}
              className="flex-shrink-0 ml-auto px-4 py-2 rounded-xl text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-all"
            >
              Cierre de Caja
            </button>
          </div>

          {/* Items Grid */}
          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 content-start">
            {filtered.map((item) => (
              <button
                key={item.id}
                onClick={() => addToCart(item)}
                className="relative rounded-2xl border border-white/8 bg-[#2C1A14]/50 p-4 flex flex-col items-center gap-2 hover:border-[#C89D54]/50 hover:bg-[#C89D54]/8 active:scale-95 transition-all group"
              >
                <span className="text-3xl">{item.emoji}</span>
                <p className="text-white/80 text-xs font-medium text-center leading-tight">{item.name}</p>
                <p className="text-[#C89D54] text-sm font-bold">{formatBs(item.price)}</p>
                {item.stock < 15 && item.stock !== 999 && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-400" title={`Stock: ${item.stock}`} />
                )}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-active:opacity-100 bg-[#C89D54]/20 transition-opacity" />
              </button>
            ))}
          </div>
        </div>

        {/* Right: Order Panel */}
        <div className="w-full md:w-80 lg:w-96 border-t md:border-t-0 md:border-l border-white/8 flex flex-col bg-[#1A0F0B] max-h-[50vh] md:max-h-none">
          <div className="px-5 py-4 border-b border-white/8">
            <h2 className="text-white font-semibold">Orden Actual</h2>
            <p className="text-white/40 text-xs">{cart.length} items</p>
          </div>

          {/* Cart */}
          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
            {cart.length === 0 ? (
              <p className="text-white/25 text-sm text-center py-8">Toca un producto para agregarlo</p>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="flex items-center gap-3 py-2 border-b border-white/5">
                  <span className="text-xl">{item.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium truncate">{item.name}</p>
                    <p className="text-[#C89D54] text-xs">{formatBs(item.price)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 rounded-full bg-white/8 flex items-center justify-center hover:bg-white/15 transition-colors">
                      <Minus size={9} className="text-white/60" />
                    </button>
                    <span className="text-white text-xs w-5 text-center font-semibold">{item.qty}</span>
                    <button onClick={() => updateQty(item.id, 1)} className="w-6 h-6 rounded-full bg-white/8 flex items-center justify-center hover:bg-white/15 transition-colors">
                      <Plus size={9} className="text-white/60" />
                    </button>
                    <button onClick={() => removeFromCart(item.id)} className="w-6 h-6 rounded-full flex items-center justify-center text-red-400/50 hover:text-red-400 transition-colors ml-1">
                      <X size={10} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Payment */}
          <div className="px-5 py-4 border-t border-white/8 space-y-3">
            <div className="flex gap-2">
              {[
                { v: "efectivo" as const, icon: <Banknote size={14} />, label: "Efectivo" },
                { v: "qr" as const, icon: <Smartphone size={14} />, label: "QR" },
                { v: "tarjeta" as const, icon: <CreditCard size={14} />, label: "Tarjeta" },
              ].map((p) => (
                <button
                  key={p.v}
                  onClick={() => setPayment(p.v)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl text-xs font-medium transition-all ${
                    payment === p.v ? "bg-[#C89D54] text-[#1A0F0B]" : "bg-white/5 text-white/50 hover:bg-white/10"
                  }`}
                >
                  {p.icon}{p.label}
                </button>
              ))}
            </div>

            <div className="flex justify-between text-sm py-2 border-t border-white/8">
              <span className="text-white/50">Total</span>
              <span className="text-[#C89D54] font-bold text-xl">{formatBs(total)}</span>
            </div>

            <button
              onClick={handleSale}
              disabled={cart.length === 0}
              className="w-full py-4 rounded-xl bg-[#C89D54] text-[#1A0F0B] font-bold text-sm tracking-wide disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#D4A373] active:scale-98 transition-all"
            >
              Cobrar — {formatBs(total)}
            </button>
          </div>
        </div>
      </div>

      {/* Cierre de Caja Modal */}
      {showCierre && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowCierre(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
          <div className="relative w-full max-w-md glass-card rounded-2xl p-7 animate-fade-up" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowCierre(false)} className="absolute top-4 right-4 text-white/40 hover:text-white">
              <X size={16} />
            </button>
            <h2 className="font-serif text-2xl text-white font-bold mb-1">Cierre de Caja</h2>
            <p className="text-white/40 text-xs mb-6">Lunes 12 Oct 2025 — Turno 08:00–18:00</p>

            <div className="space-y-3 mb-6">
              {dailySales.map((s) => (
                <div key={s.method} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/8">
                  <div>
                    <p className="text-white text-sm font-semibold">{s.method}</p>
                    <p className="text-white/40 text-xs">{s.count} transacciones</p>
                  </div>
                  <p className="text-[#C89D54] font-bold">{formatBs(s.amount)}</p>
                </div>
              ))}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#C89D54]/15 border border-[#C89D54]/30">
                <p className="text-[#C89D54] font-bold">TOTAL DEL DÍA</p>
                <p className="text-[#C89D54] font-bold text-xl">{formatBs(dailySales.reduce((s, x) => s + x.amount, 0))}</p>
              </div>
            </div>

            <button className="w-full py-3 rounded-xl bg-white/10 text-white text-sm font-semibold hover:bg-white/15 flex items-center justify-center gap-2 transition-colors">
              <Printer size={16} /> Imprimir Reporte
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
