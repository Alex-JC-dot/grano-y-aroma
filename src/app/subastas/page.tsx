"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import CartDrawer from "@/components/home/CartDrawer";
import { useAuctionStore } from "@/store/auctionStore";
import { formatBs, formatTimeLeft } from "@/lib/utils";
import { Gavel, Clock, TrendingUp, Award, Users, AlertCircle } from "lucide-react";

export default function SubastasPage() {
  const { auctions, placeBid, tickTimers } = useAuctionStore();
  const [bidAmounts, setBidAmounts] = useState<Record<string, string>>({});
  const [toasts, setToasts] = useState<{ id: string; msg: string; type: "success" | "error" }[]>([]);

  useEffect(() => {
    const interval = setInterval(tickTimers, 1000);
    return () => clearInterval(interval);
  }, [tickTimers]);

  const showToast = (id: string, msg: string, type: "success" | "error") => {
    setToasts((t) => [...t, { id: `${id}-${Date.now()}`, msg, type }]);
    setTimeout(() => setToasts((t) => t.slice(1)), 3500);
  };

  const handleBid = (auctionId: string) => {
    const amount = parseFloat(bidAmounts[auctionId] || "0");
    const auction = auctions.find((a) => a.id === auctionId);
    if (!auction) return;
    const minBid = auction.currentBid > 0 ? auction.currentBid + 20 : auction.basePrice;
    if (amount < minBid) {
      showToast(auctionId, `La puja mínima es ${formatBs(minBid)}`, "error");
      return;
    }
    const ok = placeBid(auctionId, "Tú", amount);
    if (ok) {
      showToast(auctionId, `✅ ¡Puja de ${formatBs(amount)} registrada!`, "success");
      setBidAmounts((b) => ({ ...b, [auctionId]: "" }));
    }
  };

  return (
    <main className="min-h-screen bg-[#1A0F0B]">
      <Navbar />
      <CartDrawer />

      {/* Toast notifications */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={`px-5 py-3 rounded-xl shadow-2xl text-sm font-medium animate-fade-up ${
            t.type === "success" ? "bg-green-900/80 text-green-200 border border-green-500/30" : "bg-red-900/80 text-red-200 border border-red-500/30"
          }`}>
            {t.msg}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="pt-36 md:pt-44 pb-16 px-6 sm:px-10 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2.5 border border-red-500/30 bg-red-500/10 rounded-full px-5 py-2 mb-8 shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse" />
          <span className="text-[0.68rem] text-red-300 uppercase tracking-[2.5px] font-semibold">Subastas en Vivo</span>
        </div>
        <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl text-white font-bold mb-5 leading-tight">
          Micro-lotes <em className="text-[#C89D54] not-italic italic">Exclusivos</em>
        </h1>
        <p className="text-white/60 max-w-xl mx-auto text-base leading-relaxed">
          Accede a lotes de café de especialidad directamente de las fincas de Chuquisaca y Yungas. 
          Pujas en tiempo real con cierre y adjudicación automática.
        </p>
      </div>

      {/* Auctions Grid */}
      <div className="px-6 sm:px-10 lg:px-16 xl:px-20 pb-32 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-10">
        {auctions.map((auction) => {
          const isEnded = auction.timeLeftSeconds === 0;
          const minBid = auction.currentBid > 0 ? auction.currentBid + 20 : auction.basePrice;
          const urgent = auction.timeLeftSeconds < 3600 && auction.timeLeftSeconds > 0;

          return (
            <div key={auction.id} className={`rounded-3xl border overflow-hidden flex flex-col shadow-2xl transition-all duration-300 ${
              isEnded ? "border-white/10 opacity-60" : urgent ? "border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.15)]" : "border-[#C89D54]/25 hover:border-[#C89D54]/50"
            } bg-[#2C1A14]/60 backdrop-blur-sm`}>
              {/* Image */}
              <div className="relative h-56 bg-gradient-to-br from-[#3D2219] via-[#2A1610] to-[#1A0F0B] flex items-center justify-center">
                <span className="text-7xl opacity-70 select-none">🫘</span>
                <div className="absolute inset-0 bg-gradient-to-t from-[#2C1A14] to-transparent" />
                {/* Timer */}
                <div className={`absolute top-4 right-4 flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-lg ${
                  isEnded ? "bg-gray-800 text-gray-400" : urgent ? "bg-red-950 text-red-300 border border-red-500/50 animate-pulse" : "bg-[#1A0F0B]/90 text-[#C89D54] border border-[#C89D54]/30"
                }`}>
                  <Clock size={13} />
                  {isEnded ? "CERRADA" : formatTimeLeft(auction.timeLeftSeconds)}
                </div>
                <div className="absolute bottom-4 left-4">
                  <span className="text-[0.68rem] bg-[#C89D54]/20 text-[#C89D54] border border-[#C89D54]/40 px-3 py-1.5 rounded-full font-bold">
                    ⭐ {auction.cuppingScore} pts SCA
                  </span>
                </div>
              </div>

              <div className="p-7 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-serif text-xl text-white font-bold mb-2">{auction.productName}</h3>
                  <p className="text-white/50 text-xs font-medium mb-4 flex items-center gap-1.5">
                    {auction.origin} · {auction.altitude} msnm · {auction.quantity} {auction.unit}
                  </p>
                  <p className="text-white/70 text-xs sm:text-sm leading-relaxed mb-6">{auction.description}</p>

                  {/* Current bid */}
                  <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[0.65rem] text-white/50 uppercase tracking-widest font-semibold">Puja Actual</span>
                      <div className="flex items-center gap-1.5 text-[0.65rem] text-white/50">
                        <Users size={12} />
                        <span>{auction.bids.length} pujas</span>
                      </div>
                    </div>
                    <div className="flex items-end justify-between">
                      <p className="text-[#C89D54] text-3xl font-bold font-serif">
                        {auction.currentBid > 0 ? formatBs(auction.currentBid) : formatBs(auction.basePrice)}
                      </p>
                      {auction.currentBidder && (
                        <p className="text-white/60 text-xs font-medium">Líder: {auction.currentBidder}</p>
                      )}
                    </div>
                    <p className="text-white/35 text-[0.65rem] mt-2">Precio base de salida: {formatBs(auction.basePrice)}</p>
                  </div>

                  {/* Bid history */}
                  {auction.bids.length > 0 && (
                    <div className="mb-6 max-h-28 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-black/20">
                      {auction.bids.slice(0, 3).map((bid, i) => (
                        <div key={i} className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg ${i === 0 ? "bg-[#C89D54]/15 text-[#C89D54] font-semibold" : "text-white/50"}`}>
                          <div className="flex items-center gap-2">
                            {i === 0 && <TrendingUp size={12} />}
                            <span>{bid.bidder}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span>{formatBs(bid.amount)}</span>
                            <span className="text-white/30 text-[0.65rem]">{bid.timestamp}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bid input */}
                {!isEnded ? (
                  <div className="mt-4 flex gap-3">
                    <div className="flex-1 relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#C89D54] text-xs font-bold">Bs.</span>
                      <input
                        type="number"
                        value={bidAmounts[auction.id] || ""}
                        onChange={(e) => setBidAmounts((b) => ({ ...b, [auction.id]: e.target.value }))}
                        placeholder={`Mín. ${minBid}`}
                        className="w-full pl-11 pr-3 py-3.5 bg-white/5 border border-white/15 rounded-xl text-white text-sm focus:outline-none focus:border-[#C89D54]/60 transition-colors font-medium"
                      />
                    </div>
                    <button
                      onClick={() => handleBid(auction.id)}
                      className="px-5 py-3.5 bg-[#C89D54] text-[#1A0F0B] font-bold text-sm rounded-xl hover:bg-[#D4A373] transition-all flex items-center gap-2 cursor-pointer shadow-lg whitespace-nowrap"
                    >
                      <Gavel size={16} /> Pujar
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                    {auction.currentBidder ? (
                      <div className="flex items-center justify-center gap-2 text-green-400">
                        <Award size={16} />
                        <span className="text-sm font-semibold">Ganador: {auction.currentBidder}</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 text-white/40">
                        <AlertCircle size={16} />
                        <span className="text-sm">Sin pujas — Lote no adjudicado</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
