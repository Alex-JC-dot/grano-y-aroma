import Navbar from "@/components/layout/Navbar";
import CartDrawer from "@/components/home/CartDrawer";
import HeroSection from "@/components/home/HeroSection";
import ProductCatalog from "@/components/home/ProductCatalog";
import ScrollReveal from "@/components/ui/ScrollReveal";
import Link from "next/link";
import { Coffee, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#1A0F0B]">
      <Navbar />
      <CartDrawer />

      {/* Hero */}
      <HeroSection />

      {/* Product Catalog */}
      <ScrollReveal>
        <ProductCatalog />
      </ScrollReveal>

      {/* Club Section teaser */}
      <ScrollReveal delay={100}>
        <section className="py-28 md:py-36 px-6 sm:px-10 lg:px-16 xl:px-20">
          <div className="max-w-7xl mx-auto">
            <div className="relative rounded-3xl overflow-hidden border border-[#C89D54]/25 bg-gradient-to-r from-[#2C1A14] via-[#381F17] to-[#2C1A14] p-10 sm:p-14 md:p-20 shadow-2xl">
              <div className="absolute top-0 right-0 w-80 h-80 bg-[#C89D54]/10 rounded-full blur-[90px] pointer-events-none" />
              <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-16">
                <div className="flex-1 max-w-2xl">
                  <div className="inline-flex items-center gap-2 border border-[#C89D54]/30 bg-[#C89D54]/10 rounded-full px-4 py-1.5 mb-5">
                    <span className="text-[0.68rem] text-[#C89D54] uppercase tracking-[3px] font-semibold">Membresía Exclusiva</span>
                  </div>
                  <h2 className="font-serif text-4xl sm:text-5xl text-white font-bold mb-6 leading-tight">
                    Club Grano y Aroma
                  </h2>
                  <p className="text-white/60 text-base sm:text-lg leading-relaxed mb-8">
                    Recibe micro-lotes exclusivos en tu puerta cada 15 o 30 días en Sucre y todo Bolivia. 
                    Acceso prioritario a subastas de lotes limitados, descuentos de suscripción y notas de cata detalladas 
                    directamente de nuestro maestro tostador.
                  </p>
                  <div className="flex flex-wrap gap-3.5 mb-10">
                    {["Quincenal o Mensual", "Molienda a elección", "Pausa cuando quieras", "Acceso VIP subastas"].map((b) => (
                      <span key={b} className="text-xs sm:text-sm text-[#C89D54] bg-[#C89D54]/10 border border-[#C89D54]/30 rounded-full px-4 py-1.5 font-medium">
                        ✓ {b}
                      </span>
                    ))}
                  </div>
                  <Link href="/club" className="inline-flex items-center gap-2.5 px-8 py-4 bg-[#C89D54] text-[#1A0F0B] font-bold text-sm tracking-wide rounded-2xl hover:bg-[#D4A373] transition-all shadow-lg hover:shadow-[0_0_30px_rgba(200,157,84,0.4)]">
                    Unirme al Club <ArrowRight size={17} />
                  </Link>
                </div>
                <div className="flex-shrink-0 text-center">
                  <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-full bg-gradient-to-br from-[#C89D54]/15 to-[#8B5E3C]/10 border-2 border-[#C89D54]/40 flex flex-col items-center justify-center shadow-2xl p-4 backdrop-blur-sm">
                    <Coffee size={44} className="text-[#C89D54] mb-3" />
                    <p className="text-[#C89D54] font-bold text-2xl sm:text-3xl font-serif">Bs. 89</p>
                    <p className="text-white/50 text-[0.68rem] uppercase tracking-widest mt-1">/ entrega quincenal</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 sm:px-10 lg:px-16 xl:px-20 py-16 md:py-20 bg-[#140B08]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C89D54] to-[#8B5E3C] flex items-center justify-center shadow-md">
              <Coffee size={18} className="text-white" />
            </div>
            <div>
              <p className="font-serif text-white font-bold text-base tracking-wide">Grano y Aroma</p>
              <p className="text-[0.62rem] text-[#C89D54] tracking-[2.5px] uppercase font-medium">Cafetería & Tostaduría · Sucre, Bolivia</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-8">
            {[
              { href: "/", label: "Tienda" }, { href: "/club", label: "Club" },
              { href: "/subastas", label: "Subastas" }, { href: "/pos", label: "POS" },
              { href: "/erp", label: "ERP" }, { href: "/admin", label: "Admin" },
            ].map((l) => (
              <Link key={l.href} href={l.href} className="text-white/50 hover:text-[#C89D54] text-xs uppercase tracking-wider font-medium transition-colors">
                {l.label}
              </Link>
            ))}
          </div>
          <p className="text-white/30 text-xs">© 2025 Grano y Aroma. Todos los derechos reservados.</p>
        </div>
      </footer>
    </main>
  );
}
