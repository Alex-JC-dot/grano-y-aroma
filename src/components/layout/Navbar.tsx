"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRoleStore } from "@/store/roleStore";
import { useCartStore } from "@/store/cartStore";
import { Role } from "@/lib/types";
import {
  ShoppingBag,
  ChevronDown,
  Menu,
  X,
  Coffee,
  Settings,
  ShoppingCart,
  Package,
  Truck,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

const roles: { value: Role; label: string; icon: React.ReactNode; color: string }[] = [
  { value: "cliente", label: "Cliente", icon: <Coffee size={14} />, color: "text-amber-300" },
  { value: "admin", label: "Admin", icon: <Settings size={14} />, color: "text-purple-400" },
  { value: "cajero", label: "Cajero / POS", icon: <ShoppingCart size={14} />, color: "text-blue-400" },
  { value: "tostador", label: "Tostador", icon: <Coffee size={14} />, color: "text-orange-400" },
  { value: "almacen", label: "Almacén", icon: <Package size={14} />, color: "text-green-400" },
  { value: "delivery", label: "Delivery", icon: <Truck size={14} />, color: "text-cyan-400" },
];

const navLinks = [
  { href: "/", label: "Tienda" },
  { href: "/club", label: "Club" },
  { href: "/subastas", label: "Subastas" },
  { href: "/admin", label: "Dashboard" },
];

export default function Navbar() {
  const { role, setRole } = useRoleStore();
  const { itemCount, toggleCart } = useCartStore();
  const count = useCartStore((s) => s.itemCount());
  const [scrolled, setScrolled] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const roleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (roleRef.current && !roleRef.current.contains(e.target as Node)) {
        setRoleOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const currentRole = roles.find((r) => r.value === role)!;

  return (
    <>
      <nav
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          scrolled
            ? "nav-scrolled py-3.5 shadow-2xl px-6 md:px-12"
            : "py-6 bg-transparent px-6 md:px-12"
        )}
      >
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3.5 group">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C89D54] to-[#8B5E3C] flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
              <Coffee size={19} className="text-white" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-serif font-bold text-white text-[1.05rem] tracking-wide">
                Grano y Aroma
              </span>
              <span className="text-[0.6rem] tracking-[2.5px] uppercase text-[#C89D54] font-medium">
                Especialidad · Sucre
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <ul className="hidden md:flex items-center gap-9 list-none">
            {navLinks.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="text-white/65 hover:text-[#C89D54] text-[0.78rem] tracking-[1.5px] uppercase font-medium transition-colors duration-200"
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/pos"
                className="text-white/65 hover:text-[#C89D54] text-[0.78rem] tracking-[1.5px] uppercase font-medium transition-colors duration-200"
              >
                POS
              </Link>
            </li>
            <li>
              <Link
                href="/erp"
                className="text-white/65 hover:text-[#C89D54] text-[0.78rem] tracking-[1.5px] uppercase font-medium transition-colors duration-200"
              >
                ERP
              </Link>
            </li>
          </ul>

          {/* Right Controls */}
          <div className="flex items-center gap-4">
            {/* Role Switcher */}
            <div className="relative hidden md:block" ref={roleRef}>
              <button
                onClick={() => setRoleOpen(!roleOpen)}
                className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-white/15 bg-white/5 hover:border-[#C89D54]/50 hover:bg-[#C89D54]/10 transition-all duration-200 text-xs tracking-wide"
              >
                <span className={currentRole.color}>{currentRole.icon}</span>
                <span className="text-white/80 font-medium">{currentRole.label}</span>
                <ChevronDown
                  size={13}
                  className={cn(
                    "text-white/50 transition-transform duration-200",
                    roleOpen && "rotate-180"
                  )}
                />
              </button>

              {roleOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 glass-card rounded-2xl shadow-2xl overflow-hidden animate-fade-in p-1.5">
                  <div className="px-3 py-2 border-b border-white/10 mb-1">
                    <p className="text-[0.62rem] text-white/40 uppercase tracking-widest font-semibold">
                      Cambiar Perspectiva
                    </p>
                  </div>
                  {roles.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => {
                        setRole(r.value);
                        setRoleOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3.5 py-2.5 text-left text-xs rounded-xl transition-all duration-150 hover:bg-[#C89D54]/10",
                        role === r.value
                          ? "bg-[#C89D54]/15 text-[#C89D54] font-medium"
                          : "text-white/70"
                      )}
                    >
                      <span className={r.color}>{r.icon}</span>
                      <span>{r.label}</span>
                      {role === r.value && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#C89D54]" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Cart Button */}
            <button
              onClick={toggleCart}
              className="relative flex items-center justify-center w-11 h-11 rounded-full border border-white/15 bg-white/5 hover:border-[#C89D54]/60 hover:bg-[#C89D54]/10 transition-all duration-200 group"
              aria-label="Carrito de compras"
            >
              <ShoppingBag size={19} className="text-white/80 group-hover:text-[#C89D54] transition-colors" />
              {count > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#C89D54] text-[#1A0F0B] text-[0.65rem] font-bold flex items-center justify-center animate-pulse-gold">
                  {count}
                </span>
              )}
            </button>

            {/* Hamburger */}
            <button
              className="md:hidden flex items-center justify-center w-11 h-11 rounded-xl border border-white/15 bg-white/5"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Menú principal"
            >
              {mobileOpen ? (
                <X size={20} className="text-[#C89D54]" />
              ) : (
                <Menu size={20} className="text-white/80" />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute top-0 right-0 h-full w-72 bg-[#1A0F0B] border-l border-[#C89D54]/20 flex flex-col pt-20 px-6 animate-slide-right">
            <div className="mb-6">
              <p className="text-[0.6rem] text-[#C89D54] uppercase tracking-widest mb-3">
                Navegación
              </p>
              <div className="flex flex-col gap-1">
                {[...navLinks, { href: "/pos", label: "POS" }, { href: "/erp", label: "ERP" }, { href: "/logistica", label: "Logística" }].map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setMobileOpen(false)}
                    className="text-white/70 hover:text-[#C89D54] py-3 text-sm font-medium border-b border-white/5 transition-colors"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[0.6rem] text-[#C89D54] uppercase tracking-widest mb-3">
                Cambiar Rol
              </p>
              <div className="flex flex-col gap-1">
                {roles.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => { setRole(r.value); setMobileOpen(false); }}
                    className={cn(
                      "flex items-center gap-3 py-3 text-sm border-b border-white/5 transition-all",
                      role === r.value ? "text-[#C89D54]" : "text-white/60"
                    )}
                  >
                    <span className={r.color}>{r.icon}</span>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
