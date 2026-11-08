"use client";

import { useState } from "react";
import Navbar from "@/components/layout/Navbar";
import CartDrawer from "@/components/home/CartDrawer";
import { formatBs } from "@/lib/utils";
import { BarChart3, TrendingUp, ShoppingBag, Coffee, Gavel, Users, Package, ArrowUpRight } from "lucide-react";

const salesByChannel = [
  { channel: "Online", amount: 8420, orders: 67, color: "#C89D54", pct: 40 },
  { channel: "POS Cafetería", amount: 6350, orders: 89, color: "#D4A373", pct: 30 },
  { channel: "Suscripciones", amount: 4200, orders: 42, color: "#8B5E3C", pct: 20 },
  { channel: "Subastas", amount: 2100, orders: 8, color: "#5C3D2E", pct: 10 },
];

const roastBatches = [
  { lot: "VS-2025-NAT-001", green: 120, produced: 102, sold: 87, revenue: 5440, cost: 2100, margin: 61 },
  { lot: "PAD-2025-WAS-003", green: 150, produced: 127, sold: 110, revenue: 4900, cost: 1800, margin: 63 },
  { lot: "COR-2025-DAR-002", green: 200, produced: 170, sold: 142, revenue: 3890, cost: 1600, margin: 59 },
];

const kpis = [
  { label: "Ingresos Totales", value: "Bs. 21,070", change: "+18%", icon: <TrendingUp size={20} />, color: "text-green-400" },
  { label: "Pedidos del Mes", value: "206", change: "+12%", icon: <ShoppingBag size={20} />, color: "text-blue-400" },
  { label: "Clientes Activos", value: "148", change: "+9%", icon: <Users size={20} />, color: "text-purple-400" },
  { label: "Kg Vendidos", value: "339 kg", change: "+22%", icon: <Package size={20} />, color: "text-[#C89D54]" },
];

export default function AdminPage() {
  const [period, setPeriod] = useState<"semana" | "mes" | "anio">("mes");

  return (
    <main className="min-h-screen bg-[#1A0F0B]">
      <Navbar />
      <CartDrawer />

      <div className="pt-36 md:pt-44 pb-32 px-6 sm:px-10 lg:px-16 xl:px-20 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
          <div>
            <p className="text-[0.68rem] text-[#C89D54] uppercase tracking-[3px] font-semibold mb-3">Admin Dashboard</p>
            <h1 className="font-serif text-4xl sm:text-5xl text-white font-bold">Panel de Control General</h1>
          </div>
          <div className="flex gap-2.5">
            {(["semana", "mes", "anio"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-5 py-2.5 rounded-xl text-xs font-semibold transition-all capitalize cursor-pointer ${
                  period === p ? "bg-[#C89D54] text-[#1A0F0B] shadow-md" : "bg-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                {p === "anio" ? "Año" : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="p-5 rounded-2xl border border-white/8 bg-[#2C1A14]/40 hover-lift">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${kpi.color}`}>
                  {kpi.icon}
                </div>
                <span className="text-xs text-green-400 flex items-center gap-0.5 font-semibold">
                  {kpi.change}<ArrowUpRight size={10} />
                </span>
              </div>
              <p className="text-white font-bold text-2xl mb-1">{kpi.value}</p>
              <p className="text-white/40 text-xs">{kpi.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Sales by channel */}
          <div className="p-6 rounded-2xl border border-white/8 bg-[#2C1A14]/40">
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 size={18} className="text-[#C89D54]" />
              <h2 className="text-white font-semibold">Ventas por Canal</h2>
            </div>
            <div className="space-y-4">
              {salesByChannel.map((s) => (
                <div key={s.channel}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                      <span className="text-white/70 text-sm">{s.channel}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-white/40 text-xs">{s.orders} pedidos</span>
                      <span className="text-white font-semibold text-sm">{formatBs(s.amount)}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${s.pct}%`, background: s.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/8">
              <span className="text-white/50 text-sm">Total del {period}</span>
              <span className="text-[#C89D54] font-bold text-xl">
                {formatBs(salesByChannel.reduce((s, x) => s + x.amount, 0))}
              </span>
            </div>
          </div>

          {/* Roast batch profitability */}
          <div className="p-6 rounded-2xl border border-white/8 bg-[#2C1A14]/40">
            <div className="flex items-center gap-2 mb-6">
              <Coffee size={18} className="text-[#C89D54]" />
              <h2 className="text-white font-semibold">Rentabilidad por Lote</h2>
            </div>
            <div className="space-y-4">
              {roastBatches.map((b) => (
                <div key={b.lot} className="p-4 rounded-xl bg-white/3 border border-white/8">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/70 text-xs font-mono">{b.lot}</span>
                    <span className="text-green-400 font-bold text-sm">{b.margin}% margen</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      { label: "Verde", val: `${b.green}kg` },
                      { label: "Tostado", val: `${b.produced}kg` },
                      { label: "Vendido", val: `${b.sold}kg` },
                      { label: "Ingreso", val: `Bs.${(b.revenue / 1000).toFixed(1)}k` },
                    ].map((stat) => (
                      <div key={stat.label}>
                        <p className="text-[0.6rem] text-white/30 uppercase tracking-wider">{stat.label}</p>
                        <p className="text-white text-sm font-semibold">{stat.val}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#C89D54] to-[#D4A373] rounded-full"
                      style={{ width: `${b.margin}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { href: "/pos", icon: <Coffee size={20} />, label: "Ir al POS", color: "from-[#C89D54]/20" },
            { href: "/subastas", icon: <Gavel size={20} />, label: "Subastas", color: "from-purple-500/20" },
            { href: "/erp", icon: <Package size={20} />, label: "ERP/Bodega", color: "from-green-500/20" },
            { href: "/logistica", icon: <TrendingUp size={20} />, label: "Logística", color: "from-blue-500/20" },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`p-5 rounded-2xl border border-white/8 bg-gradient-to-br ${link.color} to-transparent hover-lift flex items-center gap-3 group`}
            >
              <div className="w-10 h-10 rounded-xl bg-white/8 flex items-center justify-center text-[#C89D54] group-hover:bg-[#C89D54]/20 transition-colors">
                {link.icon}
              </div>
              <span className="text-white/70 text-sm font-medium group-hover:text-white transition-colors">{link.label}</span>
              <ArrowUpRight size={14} className="ml-auto text-white/20 group-hover:text-[#C89D54] transition-colors" />
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}
