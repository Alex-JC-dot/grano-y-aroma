"use client";

import { useState } from "react";
import Navbar from "@/components/layout/Navbar";
import CartDrawer from "@/components/home/CartDrawer";
import { inventoryItems } from "@/lib/data";
import { formatBs } from "@/lib/utils";
import { Package, AlertTriangle, Plus, FlaskConical, Star, CheckCircle } from "lucide-react";

const roastLogs = [
  { id: "RL-001", date: "2025-10-07", greenLot: "VS-2025-GRN-012", batch: "12 kg", profile: "Ligero — 195°C pico / 11:30 min", cuppingScore: 87.5, notes: "Excelente desarrollo. Acidez brillante.", lotCode: "VS-2025-NAT-001", auctionReady: true },
  { id: "RL-002", date: "2025-10-03", greenLot: "PAD-2025-GRN-009", batch: "15 kg", profile: "Medio — 205°C pico / 13:00 min", cuppingScore: 86.0, notes: "Tueste balanceado. Notas a caramelo.", lotCode: "PAD-2025-WAS-003", auctionReady: false },
  { id: "RL-003", date: "2025-09-28", greenLot: "COR-2025-GRN-004", batch: "20 kg", profile: "Oscuro — 215°C pico / 14:30 min", cuppingScore: 85.0, notes: "Para espresso. Full City+.", lotCode: "COR-2025-DAR-002", auctionReady: false },
];

export default function ERPPage() {
  const [activeTab, setActiveTab] = useState<"inventario" | "tostado">("inventario");
  const [showForm, setShowForm] = useState(false);
  const [newLog, setNewLog] = useState({ greenLot: "", batch: "", profile: "", notes: "", score: "" });

  const tabs = [
    { id: "inventario" as const, label: "Inventario & Almacén", icon: <Package size={15} /> },
    { id: "tostado" as const, label: "Registro de Tostado", icon: <FlaskConical size={15} /> },
  ];

  return (
    <main className="min-h-screen bg-[#1A0F0B]">
      <Navbar />
      <CartDrawer />

      <div className="pt-36 md:pt-44 pb-32 px-6 sm:px-10 lg:px-16 xl:px-20 max-w-7xl mx-auto">
        <div className="mb-12">
          <p className="text-[0.68rem] text-[#C89D54] uppercase tracking-[3px] font-semibold mb-3">ERP & Producción</p>
          <h1 className="font-serif text-4xl sm:text-5xl text-white font-bold">Producción & Inventario</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-12 border-b border-white/10 pb-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all -mb-px ${
                activeTab === t.id
                  ? "border-[#C89D54] text-[#C89D54]"
                  : "border-transparent text-white/50 hover:text-white/80"
              }`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* INVENTARIO TAB */}
        {activeTab === "inventario" && (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {["verde", "tostado", "insumo"].map((type) => {
                const items = inventoryItems.filter((i) => i.type === type);
                const low = items.filter((i) => i.quantity <= i.minStock).length;
                const labels: Record<string, string> = { verde: "Café Verde", tostado: "Café Tostado", insumo: "Insumos" };
                return (
                  <div key={type} className="p-5 rounded-2xl border border-white/8 bg-[#2C1A14]/40">
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-1">{labels[type]}</p>
                    <p className="text-white font-bold text-2xl">{items.length} items</p>
                    {low > 0 && (
                      <div className="flex items-center gap-1 mt-2 text-yellow-400 text-xs">
                        <AlertTriangle size={12} />{low} bajo mínimo
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="rounded-2xl border border-white/8 overflow-hidden">
              <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
                <h2 className="text-white font-semibold text-sm">Stock Actual</h2>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C89D54]/15 text-[#C89D54] text-xs hover:bg-[#C89D54]/25 transition-colors">
                  <Plus size={12} />Agregar
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/8 bg-white/3">
                      {["Producto", "Tipo", "Stock", "Unidad", "Mín.", "Estado"].map((h) => (
                        <th key={h} className="text-left px-5 py-3 text-white/40 text-xs font-medium uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryItems.map((item) => {
                      const isLow = item.quantity <= item.minStock;
                      const typeColors: Record<string, string> = {
                        verde: "bg-green-500/15 text-green-300 border-green-500/30",
                        tostado: "bg-[#C89D54]/15 text-[#C89D54] border-[#C89D54]/30",
                        insumo: "bg-blue-500/15 text-blue-300 border-blue-500/30",
                      };
                      return (
                        <tr key={item.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                          <td className="px-5 py-3.5">
                            <p className="text-white font-medium">{item.name}</p>
                            {item.lotCode && <p className="text-white/30 text-xs">{item.lotCode}</p>}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`text-[0.65rem] px-2 py-1 rounded-full border ${typeColors[item.type]}`}>
                              {item.type}
                            </span>
                          </td>
                          <td className={`px-5 py-3.5 font-bold ${isLow ? "text-yellow-400" : "text-white"}`}>
                            {item.quantity}
                          </td>
                          <td className="px-5 py-3.5 text-white/50">{item.unit}</td>
                          <td className="px-5 py-3.5 text-white/40">{item.minStock}</td>
                          <td className="px-5 py-3.5">
                            {isLow ? (
                              <div className="flex items-center gap-1.5 text-yellow-400 text-xs">
                                <AlertTriangle size={12} /> Bajo stock
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-green-400 text-xs">
                                <CheckCircle size={12} /> OK
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TOSTADO TAB */}
        {activeTab === "tostado" && (
          <div>
            <div className="flex justify-end mb-6">
              <button
                onClick={() => setShowForm(!showForm)}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#C89D54] text-[#1A0F0B] rounded-xl font-bold text-sm hover:bg-[#D4A373] transition-all"
              >
                <Plus size={16} /> Nuevo Registro
              </button>
            </div>

            {showForm && (
              <div className="mb-8 p-6 rounded-2xl border border-[#C89D54]/25 bg-[#2C1A14]/40 animate-fade-up">
                <h3 className="text-white font-semibold mb-4">Registro de Tueste</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { label: "Lote verde", key: "greenLot", placeholder: "VS-2025-GRN-012" },
                    { label: "Cantidad (kg)", key: "batch", placeholder: "15 kg" },
                    { label: "Perfil de tueste", key: "profile", placeholder: "Ligero — 195°C / 11:30 min" },
                    { label: "Cupping Score", key: "score", placeholder: "87.5" },
                  ].map((f) => (
                    <div key={f.key}>
                      <label className="block text-xs text-white/50 mb-1 uppercase tracking-wider">{f.label}</label>
                      <input
                        type="text"
                        placeholder={f.placeholder}
                        value={newLog[f.key as keyof typeof newLog]}
                        onChange={(e) => setNewLog((n) => ({ ...n, [f.key]: e.target.value }))}
                        className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#C89D54]/50"
                      />
                    </div>
                  ))}
                  <div className="md:col-span-2">
                    <label className="block text-xs text-white/50 mb-1 uppercase tracking-wider">Notas de cata</label>
                    <textarea
                      rows={2}
                      placeholder="Observaciones del cupping..."
                      className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#C89D54]/50 resize-none"
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => { alert("Registro guardado con código: VS-2025-NAT-00" + (roastLogs.length + 1)); setShowForm(false); }}
                    className="px-5 py-2.5 bg-[#C89D54] text-[#1A0F0B] rounded-xl font-bold text-sm hover:bg-[#D4A373] transition-all"
                  >
                    Guardar & Generar Código
                  </button>
                  <button onClick={() => setShowForm(false)} className="px-5 py-2.5 border border-white/15 text-white/60 rounded-xl text-sm hover:border-white/30 transition-colors">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {roastLogs.map((log) => (
                <div key={log.id} className="p-5 rounded-2xl border border-white/8 bg-[#2C1A14]/30 flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[0.6rem] text-white/40 bg-white/5 px-2 py-1 rounded">{log.id}</span>
                      <span className="text-white/40 text-xs">{log.date}</span>
                      {log.auctionReady && (
                        <span className="text-[0.6rem] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-1 rounded-full">
                          ★ Apto Subasta
                        </span>
                      )}
                    </div>
                    <h3 className="text-white font-semibold mb-1">{log.lotCode}</h3>
                    <p className="text-white/40 text-xs mb-1">Verde: {log.greenLot} · Lote: {log.batch}</p>
                    <p className="text-white/50 text-xs">{log.profile}</p>
                    <p className="text-white/40 text-xs mt-1 italic">"{log.notes}"</p>
                  </div>
                  <div className="flex-shrink-0 text-center md:text-right">
                    <div className="inline-flex flex-col items-center justify-center w-20 h-20 rounded-2xl border border-[#C89D54]/30 bg-[#C89D54]/10">
                      <Star size={16} className="text-[#C89D54] fill-[#C89D54] mb-1" />
                      <p className="text-[#C89D54] text-xl font-bold">{log.cuppingScore}</p>
                      <p className="text-white/30 text-[0.55rem]">puntos</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
