"use client";

import { useState } from "react";
import { products } from "@/lib/data";
import { Product } from "@/lib/types";
import { useCartStore } from "@/store/cartStore";
import { formatBs } from "@/lib/utils";
import { Star, MapPin, Thermometer, Award, Plus, X, ChevronDown } from "lucide-react";

const origins = ["Todos", "Chuquisaca", "La Paz"];
const roastLevels = ["Todos", "Ligero", "Medio", "Oscuro"];
const flavors = ["Todos", "Frutal", "Floral", "Cítrico", "Chocolate", "Caramelo", "Nuez", "Miel"];
const grindTypes = ["Todos", "Grano Entero", "Espresso", "V60", "French Press", "Moka"];

export default function ProductCatalog() {
  const [origin, setOrigin] = useState("Todos");
  const [roast, setRoast] = useState("Todos");
  const [flavor, setFlavor] = useState("Todos");
  const [grind, setGrind] = useState("Todos");
  const [selected, setSelected] = useState<Product | null>(null);
  const [selectedGrind, setSelectedGrind] = useState("");
  const [added, setAdded] = useState<string | null>(null);
  const { addItem, toggleCart } = useCartStore();

  const filtered = products.filter((p) => {
    if (origin !== "Todos" && p.origin !== origin) return false;
    if (roast !== "Todos" && p.roastLevel !== roast) return false;
    if (flavor !== "Todos" && !p.flavorProfile.includes(flavor)) return false;
    if (grind !== "Todos" && !p.grindTypes.includes(grind)) return false;
    return true;
  });

  const handleAdd = (product: Product) => {
    const grindChoice = selectedGrind || product.grindTypes[0];
    addItem(product, grindChoice);
    setAdded(product.id);
    setTimeout(() => setAdded(null), 2000);
    setSelected(null);
  };

  const roastClass: Record<string, string> = {
    Ligero: "roast-light",
    Medio: "roast-medium",
    Oscuro: "roast-dark",
  };

  return (
    <section className="py-28 md:py-40 px-6 sm:px-10 lg:px-16 xl:px-20 scroll-mt-28 md:scroll-mt-36" id="catalogo">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-16 md:mb-20 text-center">
          <p className="text-[0.68rem] text-[#C89D54] uppercase tracking-[3px] font-semibold mb-4">Catálogo de Especialidad</p>
          <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl text-white mb-6">
            Café de <em className="text-[#C89D54] not-italic italic">Origen</em>
          </h2>
          <p className="text-white/60 max-w-2xl mx-auto text-base sm:text-lg leading-relaxed font-normal">
            Micro-lotes seleccionados de las mejores fincas de Chuquisaca y los Yungas paceños, 
            con trazabilidad completa desde el cultivo hasta tu taza.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-16 p-5 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-sm shadow-lg">
          <div className="flex flex-wrap gap-3 items-center">
            <FilterSelect label="Origen" value={origin} options={origins} onChange={setOrigin} />
            <FilterSelect label="Tueste" value={roast} options={roastLevels} onChange={setRoast} />
            <FilterSelect label="Perfil" value={flavor} options={flavors} onChange={setFlavor} />
            <FilterSelect label="Molienda" value={grind} options={grindTypes} onChange={setGrind} />
            {(origin !== "Todos" || roast !== "Todos" || flavor !== "Todos" || grind !== "Todos") && (
              <button
                onClick={() => { setOrigin("Todos"); setRoast("Todos"); setFlavor("Todos"); setGrind("Todos"); }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs text-red-400/80 hover:text-red-400 border border-red-400/25 hover:border-red-400/50 transition-all font-medium"
              >
                <X size={13} /> Limpiar filtros
              </button>
            )}
          </div>
          <div className="text-xs text-white/40 font-medium tracking-wide">
            {filtered.length} producto{filtered.length !== 1 ? "s" : ""} disponible{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
          {filtered.map((product) => (
            <div
              key={product.id}
              className="group relative rounded-3xl border border-white/10 bg-[#2C1A14]/50 overflow-hidden hover-lift cursor-pointer flex flex-col justify-between shadow-xl"
              onClick={() => { setSelected(product); setSelectedGrind(product.grindTypes[0]); }}
            >
              <div>
                {/* Image area */}
                <div className="relative h-60 sm:h-64 bg-gradient-to-br from-[#3D2219] via-[#2A1610] to-[#1A0F0B] flex items-center justify-center overflow-hidden">
                  <div className="text-8xl opacity-75 group-hover:scale-110 transition-transform duration-500 select-none">☕</div>
                  <div className="absolute inset-0 bg-gradient-to-t from-[#2C1A14] via-transparent to-transparent" />
                  
                  {/* Badges */}
                  <div className="absolute top-4 left-4 flex gap-2">
                    <span className={`text-[0.65rem] px-3 py-1.5 rounded-full font-semibold ${roastClass[product.roastLevel]}`}>
                      {product.roastLevel}
                    </span>
                    {product.isAuctionEligible && (
                      <span className="text-[0.65rem] px-3 py-1.5 rounded-full font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        ★ Subasta
                      </span>
                    )}
                  </div>
                  <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-black/60 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/10">
                    <Star size={12} className="text-[#C89D54] fill-[#C89D54]" />
                    <span className="text-[0.72rem] text-white font-bold">{product.cuppingScore}</span>
                  </div>
                </div>

                {/* Info */}
                <div className="p-6 sm:p-7">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h3 className="text-white font-semibold text-lg group-hover:text-[#C89D54] transition-colors leading-snug">{product.name}</h3>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <MapPin size={12} className="text-[#C89D54]" />
                        <span className="text-white/50 text-xs font-medium">{product.region}, {product.origin}</span>
                      </div>
                    </div>
                    <span className="text-[#C89D54] font-bold text-xl whitespace-nowrap">{formatBs(product.price)}</span>
                  </div>

                  {/* Traceability mini */}
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/10">
                    <span className="text-[0.65rem] text-white/50 bg-white/5 px-2.5 py-1 rounded-md font-medium">
                      {product.altitude} msnm
                    </span>
                    <span className="text-[0.65rem] text-white/50 bg-white/5 px-2.5 py-1 rounded-md font-mono">
                      {product.lotCode}
                    </span>
                    {product.flavorProfile.slice(0, 2).map((f) => (
                      <span key={f} className="text-[0.65rem] text-[#C89D54]/90 bg-[#C89D54]/10 border border-[#C89D54]/20 px-2.5 py-1 rounded-md font-medium">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="px-6 pb-6 sm:px-7 sm:pb-7">
                <button
                  className={`w-full py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                    added === product.id
                      ? "bg-green-500/25 text-green-300 border border-green-500/40"
                      : "bg-[#C89D54]/15 text-[#C89D54] border border-[#C89D54]/30 hover:bg-[#C89D54] hover:text-[#1A0F0B]"
                  }`}
                  onClick={(e) => { e.stopPropagation(); handleAdd(product); }}
                >
                  {added === product.id ? "✓ Agregado al Carrito" : <><Plus size={16} /> Agregar al Carrito</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Product Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
          <div
            className="relative w-full max-w-2xl glass-card rounded-2xl overflow-hidden animate-fade-up max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setSelected(null)} className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center hover:bg-black/60 transition-colors">
              <X size={14} className="text-white" />
            </button>

            <div className="h-48 bg-gradient-to-br from-[#3D2219] to-[#1A0F0B] flex items-center justify-center">
              <span className="text-8xl opacity-70">☕</span>
            </div>

            <div className="p-7">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="font-serif text-2xl text-white font-bold">{selected.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <MapPin size={12} className="text-[#C89D54]" />
                    <span className="text-white/50 text-sm">{selected.region}, {selected.origin}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[#C89D54] text-2xl font-bold">{formatBs(selected.price)}</p>
                  <p className="text-white/40 text-xs">por 250g</p>
                </div>
              </div>

              {/* Traceability Card */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5 p-4 rounded-xl bg-white/5 border border-white/8">
                {[
                  { label: "Código Lote", val: selected.lotCode, small: true },
                  { label: "Altitud", val: `${selected.altitude} msnm` },
                  { label: "Cupping Score", val: `${selected.cuppingScore} pts` },
                  { label: "Fecha Tueste", val: selected.roastDate },
                ].map((item) => (
                  <div key={item.label} className="text-center">
                    <p className="text-[0.55rem] text-white/40 uppercase tracking-wider mb-1">{item.label}</p>
                    <p className={`text-white font-semibold ${item.small ? "text-[0.65rem]" : "text-sm"}`}>{item.val}</p>
                  </div>
                ))}
              </div>

              <div className="mb-5">
                <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Notas de Cata</p>
                <p className="text-white/70 text-sm leading-relaxed italic">"{selected.cuppingNotes}"</p>
              </div>

              <div className="mb-6">
                <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Molienda</p>
                <div className="flex flex-wrap gap-2">
                  {selected.grindTypes.map((g) => (
                    <button
                      key={g}
                      onClick={() => setSelectedGrind(g)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        selectedGrind === g
                          ? "bg-[#C89D54] text-[#1A0F0B]"
                          : "border border-white/15 text-white/60 hover:border-[#C89D54]/40"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => { handleAdd(selected); toggleCart(); }}
                className="w-full py-4 rounded-xl bg-[#C89D54] text-[#1A0F0B] font-bold text-sm tracking-wide hover:bg-[#D4A373] transition-all duration-200"
              >
                Agregar al carrito — {formatBs(selected.price)}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function FilterSelect({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-3 pr-8 py-2 rounded-lg bg-white/5 border border-white/12 text-white/70 text-xs focus:outline-none focus:border-[#C89D54]/50 cursor-pointer transition-colors hover:border-white/25"
      >
        <option value="" disabled className="bg-[#1A0F0B]">{label}</option>
        {options.map((o) => (
          <option key={o} value={o} className="bg-[#1A0F0B] text-white">{o}</option>
        ))}
      </select>
      <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
    </div>
  );
}
