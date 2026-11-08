"use client";

import Link from "next/link";
import { Coffee, Gavel, Package, Star } from "lucide-react";

const stats = [
  { value: "85+", label: "Puntos Cupping" },
  { value: "6", label: "Fincas Aliadas" },
  { value: "3", label: "Regiones Bolivia" },
  { value: "100%", label: "Trazabilidad" },
];

const scrollTo = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
};

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center overflow-hidden grain-overlay pt-36 md:pt-48 pb-28 md:pb-36">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1A0F0B] via-[#2C1A14] to-[#1A0F0B]" />
      {/* Radial glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-[#C89D54]/10 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[500px] h-[500px] rounded-full bg-[#C89D54]/5 blur-[120px] pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 text-center px-6 sm:px-10 max-w-5xl mx-auto w-full flex flex-col items-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2.5 border border-[#C89D54]/30 bg-[#C89D54]/10 rounded-full px-5 py-2.5 mb-10 shadow-sm backdrop-blur-sm">
          <Star size={13} className="text-[#C89D54] fill-[#C89D54]" />
          <span className="text-[0.68rem] text-[#C89D54] uppercase tracking-[2.5px] font-semibold">
            Café de Especialidad · Sucre, Bolivia
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-serif text-5xl sm:text-6xl md:text-7xl lg:text-8xl text-white leading-[1.08] mb-8 tracking-tight max-w-4xl">
          Del Grano a{" "}
          <span className="relative inline-block">
            <span className="gradient-text italic">tu Taza</span>
            <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 8" fill="none">
              <path d="M2 6 C50 2 250 2 298 6" stroke="#C89D54" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
            </svg>
          </span>
        </h1>

        <p className="text-white/60 text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-8 leading-relaxed font-normal">
          Micro-lotes exclusivos de <strong className="text-white/90 font-medium">Villa Serrano</strong> y{" "}
          <strong className="text-white/90 font-medium">Padilla</strong>, Chuquisaca, y los Yungas de{" "}
          <strong className="text-white/90 font-medium">Caranavi</strong>. Trazabilidad completa desde la finca, cupping 
          profesional y subastas en tiempo real.
        </p>

        {/* Origin tags */}
        <div className="flex flex-wrap justify-center gap-2.5 mb-12 max-w-lg">
          {["Villa Serrano", "Padilla", "Caranavi", "Yungas", "Coroico"].map((place) => (
            <span
              key={place}
              className="text-[0.65rem] text-[#C89D54]/75 border border-[#C89D54]/25 bg-[#C89D54]/5 rounded-full px-3.5 py-1.5 tracking-wider font-medium"
            >
              {place}
            </span>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-5 justify-center w-full max-w-md sm:max-w-none mb-20">
          <button
            onClick={() => scrollTo("catalogo")}
            className="px-9 py-4 bg-[#C89D54] text-[#1A0F0B] font-bold text-sm tracking-wide rounded-2xl hover:bg-[#D4A373] transition-all duration-200 hover:shadow-[0_0_35px_rgba(200,157,84,0.45)] flex items-center justify-center gap-2.5 shadow-lg cursor-pointer"
          >
            <Coffee size={18} />
            Explorar Catálogo
          </button>
          <Link
            href="/subastas"
            className="px-9 py-4 border border-[#C89D54]/45 text-[#C89D54] font-semibold text-sm tracking-wide rounded-2xl hover:border-[#C89D54] hover:bg-[#C89D54]/10 transition-all duration-200 flex items-center justify-center gap-2.5 backdrop-blur-sm"
          >
            <Gavel size={18} />
            Ver Subastas en Vivo
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 sm:gap-6 w-full max-w-3xl mx-auto mb-16">
          {stats.map((s) => (
            <div key={s.label} className="text-center p-6 sm:p-7 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-sm hover:border-[#C89D54]/30 transition-colors">
              <p className="font-serif text-3xl sm:text-4xl text-[#C89D54] font-bold mb-1">{s.value}</p>
              <p className="text-white/50 text-xs uppercase tracking-widest font-medium">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-4xl mx-auto pt-4">
          {[
            { icon: <Coffee size={18} />, title: "E-Commerce & Club", desc: "Tienda online y suscripciones mensuales a domicilio" },
            { icon: <Gavel size={18} />, title: "Subastas en Vivo", desc: "Pujas en tiempo real por micro-lotes exclusivos" },
            { icon: <Package size={18} />, title: "ERP & POS Trazable", desc: "Control total de tostado, stock y punto de venta físico" },
          ].map((f) => (
            <div
              key={f.title}
              className="bg-[#2C1A14]/70 backdrop-blur-md border border-[#C89D54]/20 rounded-2xl p-6 flex items-start gap-4 text-left hover:border-[#C89D54]/40 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-[#C89D54]/15 border border-[#C89D54]/30 flex-shrink-0 flex items-center justify-center text-[#C89D54]">
                {f.icon}
              </div>
              <div>
                <p className="text-white text-sm font-semibold mb-1">{f.title}</p>
                <p className="text-white/50 text-xs leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
