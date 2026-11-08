"use client";

import { useState } from "react";
import Navbar from "@/components/layout/Navbar";
import CartDrawer from "@/components/home/CartDrawer";
import { formatBs } from "@/lib/utils";
import { Coffee, Calendar, Pause, Edit, X, CheckCircle } from "lucide-react";

const plans = [
  {
    id: "quincenal",
    label: "Quincenal",
    desc: "Cada 15 días",
    price: 89,
    savings: "5%",
    popular: false,
  },
  {
    id: "mensual",
    label: "Mensual",
    desc: "Cada 30 días",
    price: 155,
    savings: "10%",
    popular: true,
  },
];

const grindOptions = ["Grano Entero", "Espresso", "V60", "French Press", "Moka"];
const quantities = ["250g", "500g", "1 kg"];

const mockSub = {
  plan: "Mensual",
  qty: "500g",
  grind: "V60",
  nextDelivery: "22 Oct 2025",
  status: "activa",
  product: "Villa Serrano Natural",
};

export default function ClubPage() {
  const [step, setStep] = useState(0);
  const [plan, setPlan] = useState("mensual");
  const [qty, setQty] = useState("500g");
  const [grind, setGrind] = useState("V60");
  const [hasSub] = useState(true);
  const [subStatus, setSubStatus] = useState(mockSub.status);

  return (
    <main className="min-h-screen bg-[#1A0F0B]">
      <Navbar />
      <CartDrawer />

      <div className="pt-36 md:pt-44 pb-32 px-6 sm:px-10 max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2.5 border border-[#C89D54]/30 bg-[#C89D54]/10 rounded-full px-5 py-2 mb-8 shadow-sm">
            <Coffee size={13} className="text-[#C89D54]" />
            <span className="text-[0.68rem] text-[#C89D54] uppercase tracking-[2.5px] font-semibold">Membresía Exclusiva</span>
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl text-white font-bold mb-5 leading-tight">
            Club Grano y Aroma
          </h1>
          <p className="text-white/60 max-w-xl mx-auto text-base sm:text-lg leading-relaxed">
            Recibe los mejores micro-lotes de Bolivia directo en tu puerta. 
            Tú decides la frecuencia, la cantidad y el tipo de molienda.
          </p>
        </div>

        {/* Active Subscription */}
        {hasSub && (
          <div className="mb-16 p-8 sm:p-10 rounded-3xl border border-[#C89D54]/30 bg-[#2C1A14]/70 shadow-2xl backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-6">
              <CheckCircle size={20} className="text-green-400" />
              <h2 className="text-white font-bold text-lg">Tu Suscripción Activa</h2>
              <span className={`ml-auto text-xs px-3 py-1 rounded-full font-semibold uppercase tracking-wider ${subStatus === "activa" ? "bg-green-500/20 text-green-300 border border-green-500/35" : "bg-yellow-500/20 text-yellow-300 border border-yellow-500/35"}`}>
                {subStatus}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-7">
              {[
                { label: "Plan", val: mockSub.plan },
                { label: "Cantidad", val: mockSub.qty },
                { label: "Molienda", val: mockSub.grind },
                { label: "Próx. entrega", val: mockSub.nextDelivery },
              ].map((d) => (
                <div key={d.label} className="text-center p-4 rounded-2xl bg-white/[0.04] border border-white/10">
                  <p className="text-[0.62rem] text-white/45 uppercase tracking-widest mb-1.5 font-medium">{d.label}</p>
                  <p className="text-white font-bold text-base">{d.val}</p>
                </div>
              ))}
            </div>
            <p className="text-white/60 text-sm mb-6">
              Producto en preparación: <strong className="text-[#C89D54] font-semibold">{mockSub.product}</strong>
            </p>
            <div className="flex flex-wrap gap-3.5 pt-4 border-t border-white/10">
              <button
                onClick={() => setSubStatus(subStatus === "activa" ? "pausada" : "activa")}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-yellow-500/35 text-yellow-300 text-xs font-semibold hover:bg-yellow-500/10 transition-colors cursor-pointer"
              >
                <Pause size={13} />
                {subStatus === "activa" ? "Pausar entrega" : "Reanudar entrega"}
              </button>
              <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-blue-500/35 text-blue-300 text-xs font-semibold hover:bg-blue-500/10 transition-colors cursor-pointer">
                <Calendar size={13} />
                Cambiar fecha
              </button>
              <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/20 text-white/70 text-xs font-semibold hover:border-white/40 transition-colors cursor-pointer">
                <Edit size={13} />
                Modificar
              </button>
              <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-red-500/30 text-red-400/80 text-xs font-semibold hover:bg-red-500/10 transition-colors ml-auto cursor-pointer">
                <X size={13} />
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Plan Selector */}
        <h2 className="font-serif text-2xl sm:text-3xl text-white font-bold mb-8">
          {hasSub ? "Cambiar Plan o Frecuencia" : "Elige tu Plan"}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {plans.map((p) => (
            <div
              key={p.id}
              onClick={() => setPlan(p.id)}
              className={`relative rounded-3xl border p-8 cursor-pointer transition-all shadow-xl ${
                plan === p.id
                  ? "border-[#C89D54] bg-[#C89D54]/12 shadow-[0_0_30px_rgba(200,157,84,0.15)]"
                  : "border-white/10 bg-[#2C1A14]/40 hover:border-white/30"
              }`}
            >
              {p.popular && (
                <span className="absolute top-6 right-6 text-[0.65rem] bg-[#C89D54] text-[#1A0F0B] px-3 py-1 rounded-full font-bold uppercase tracking-wider">
                  Más Popular
                </span>
              )}
              <div className={`w-5 h-5 rounded-full border-2 mb-5 flex items-center justify-center ${plan === p.id ? "border-[#C89D54] bg-[#C89D54]" : "border-white/30"}`}>
                {plan === p.id && <div className="w-2 h-2 rounded-full bg-[#1A0F0B]" />}
              </div>
              <p className="text-white font-bold text-xl mb-1">{p.label}</p>
              <p className="text-white/50 text-sm mb-3">{p.desc}</p>
              <div className="flex items-end gap-2">
                <p className="text-[#C89D54] text-3xl font-bold">{formatBs(p.price)}</p>
                <p className="text-white/40 text-sm mb-1">/ entrega</p>
                <span className="ml-auto text-[0.65rem] text-green-400 border border-green-500/30 rounded-full px-2 py-0.5">
                  Ahorra {p.savings}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Preferences */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <label className="block text-xs text-white/50 uppercase tracking-wider mb-3">Cantidad</label>
            <div className="flex gap-3">
              {quantities.map((q) => (
                <button
                  key={q}
                  onClick={() => setQty(q)}
                  className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
                    qty === q ? "bg-[#C89D54] text-[#1A0F0B]" : "border border-white/15 text-white/60 hover:border-[#C89D54]/40"
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-white/50 uppercase tracking-wider mb-3">Molienda</label>
            <div className="grid grid-cols-3 gap-2">
              {grindOptions.map((g) => (
                <button
                  key={g}
                  onClick={() => setGrind(g)}
                  className={`py-2 rounded-xl text-xs font-medium transition-all ${
                    grind === g ? "bg-[#C89D54] text-[#1A0F0B]" : "border border-white/15 text-white/60 hover:border-[#C89D54]/40"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="flex flex-wrap gap-3 mb-8">
          {["Envío gratis", "Notas de cata del tostador", "Acceso VIP subastas", "Pausa cuando quieras", "Trazabilidad completa", "Descuento miembro 15%"].map((b) => (
            <span key={b} className="flex items-center gap-1.5 text-xs text-[#C89D54]/80 border border-[#C89D54]/20 rounded-full px-3 py-1.5">
              <CheckCircle size={10} />
              {b}
            </span>
          ))}
        </div>

        <button
          onClick={() => alert(`¡Suscripción ${plan} configurada!\n${qty} · ${grind}\n\nRecibirás tu primer envío en 3-5 días hábiles. ☕`)}
          className="w-full md:w-auto px-10 py-4 bg-[#C89D54] text-[#1A0F0B] font-bold text-sm tracking-wide rounded-xl hover:bg-[#D4A373] transition-all hover:shadow-[0_0_30px_rgba(200,157,84,0.3)]"
        >
          {hasSub ? "Actualizar Suscripción" : `Suscribirme — ${formatBs(plan === "mensual" ? 155 : 89)} / entrega`}
        </button>
      </div>
    </main>
  );
}
