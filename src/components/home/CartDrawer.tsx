"use client";

import { useEffect, useState } from "react";
import { useCartStore } from "@/store/cartStore";
import { formatBs } from "@/lib/utils";
import { X, Minus, Plus, ShoppingBag, Trash2, ArrowRight } from "lucide-react";

export default function CartDrawer() {
  const { items, isOpen, toggleCart, removeItem, updateQuantity, clearCart } =
    useCartStore();
  const total = useCartStore((s) => s.total());
  const [mounted, setMounted] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(0);

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const steps = ["Carrito", "Datos", "Pago"];

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
          onClick={toggleCart}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md z-[70] flex flex-col bg-[#1A0F0B] border-l border-[#C89D54]/20 shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
          <div>
            <h2 className="font-serif text-xl font-semibold text-white">
              {steps[checkoutStep]}
            </h2>
            <div className="flex gap-2 mt-1">
              {steps.map((s, i) => (
                <div
                  key={s}
                  className={`h-0.5 flex-1 rounded transition-all ${
                    i <= checkoutStep ? "bg-[#C89D54]" : "bg-white/15"
                  }`}
                />
              ))}
            </div>
          </div>
          <button
            onClick={toggleCart}
            className="w-9 h-9 rounded-full border border-white/15 flex items-center justify-center hover:border-[#C89D54]/50 transition-colors"
          >
            <X size={16} className="text-white/70" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {checkoutStep === 0 && (
            <>
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                  <ShoppingBag size={48} className="text-white/20" />
                  <p className="text-white/40 text-sm">Tu carrito está vacío</p>
                  <button
                    onClick={toggleCart}
                    className="text-[#C89D54] text-sm underline underline-offset-4"
                  >
                    Explorar productos
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => (
                    <div
                      key={`${item.id}-${item.selectedGrind}`}
                      className="flex gap-4 p-4 rounded-xl border border-white/8 bg-white/3 hover:border-[#C89D54]/20 transition-colors"
                    >
                      <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-[#C89D54]/20 to-[#2C1A14] flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl">☕</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{item.name}</p>
                        <p className="text-white/40 text-xs mt-0.5">{item.selectedGrind}</p>
                        <p className="text-[#C89D54] text-sm font-semibold mt-1">
                          {formatBs(item.price)}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => updateQuantity(`${item.id}`, item.quantity - 1)}
                            className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center hover:border-[#C89D54]/50 transition-colors"
                          >
                            <Minus size={10} className="text-white/60" />
                          </button>
                          <span className="text-white text-sm w-6 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(`${item.id}`, item.quantity + 1)}
                            className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center hover:border-[#C89D54]/50 transition-colors"
                          >
                            <Plus size={10} className="text-white/60" />
                          </button>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="ml-auto text-red-400/60 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {checkoutStep === 1 && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs text-white/50 mb-2 uppercase tracking-wider">Nombre completo</label>
                <input type="text" placeholder="Ej: María López" className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#C89D54]/50 transition-colors" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-2 uppercase tracking-wider">Teléfono</label>
                <input type="tel" placeholder="+591 7XXXXXXX" className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#C89D54]/50 transition-colors" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-2 uppercase tracking-wider">Dirección de entrega</label>
                <input type="text" placeholder="Calle, Barrio, Sucre" className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#C89D54]/50 transition-colors" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-2 uppercase tracking-wider">Referencia</label>
                <textarea placeholder="Frente al parque..." rows={2} className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#C89D54]/50 transition-colors resize-none" />
              </div>
            </div>
          )}

          {checkoutStep === 2 && (
            <div className="space-y-4">
              <p className="text-white/50 text-xs uppercase tracking-wider mb-4">Método de Pago</p>
              <div className="p-4 rounded-xl border border-[#C89D54]/40 bg-[#C89D54]/10 cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center text-white text-xs font-bold">QR</div>
                  <div>
                    <p className="text-white text-sm font-medium">Pago QR Bolivia</p>
                    <p className="text-white/40 text-xs">Simple QR — BCB</p>
                  </div>
                  <div className="ml-auto w-4 h-4 rounded-full border-2 border-[#C89D54] bg-[#C89D54]" />
                </div>
              </div>
              <div className="p-4 rounded-xl border border-white/10 cursor-pointer hover:border-[#C89D54]/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center text-white text-xs font-bold">💳</div>
                  <div>
                    <p className="text-white text-sm font-medium">Tarjeta Crédito/Débito</p>
                    <p className="text-white/40 text-xs">Visa, Mastercard</p>
                  </div>
                  <div className="ml-auto w-4 h-4 rounded-full border-2 border-white/20" />
                </div>
              </div>
              <div className="mt-6 p-4 rounded-xl bg-white/3 border border-white/8 space-y-2">
                <div className="flex justify-between text-sm text-white/60">
                  <span>Subtotal</span><span>{formatBs(total)}</span>
                </div>
                <div className="flex justify-between text-sm text-white/60">
                  <span>Envío</span><span className="text-green-400">Gratis</span>
                </div>
                <div className="flex justify-between text-white font-semibold border-t border-white/10 pt-2 mt-2">
                  <span>Total</span><span className="text-[#C89D54]">{formatBs(total)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="px-6 py-5 border-t border-white/10">
            {checkoutStep < 2 ? (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Total ({useCartStore.getState().itemCount()} items)</span>
                  <span className="text-[#C89D54] font-bold text-base">{formatBs(total)}</span>
                </div>
                <button
                  onClick={() => setCheckoutStep((s) => s + 1)}
                  className="w-full py-4 rounded-xl bg-[#C89D54] text-[#1A0F0B] font-bold text-sm tracking-wide hover:bg-[#D4A373] transition-all duration-200 flex items-center justify-center gap-2 hover:gap-3"
                >
                  {checkoutStep === 0 ? "Proceder al Checkout" : "Continuar"}
                  <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  alert("¡Pedido realizado! Recibirás confirmación en breve. ☕");
                  clearCart();
                  setCheckoutStep(0);
                  toggleCart();
                }}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-[#C89D54] to-[#D4A373] text-[#1A0F0B] font-bold text-sm tracking-wide hover:opacity-90 transition-all"
              >
                Confirmar Pedido — {formatBs(total)}
              </button>
            )}
            {checkoutStep > 0 && (
              <button
                onClick={() => setCheckoutStep((s) => s - 1)}
                className="w-full mt-2 text-center text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                ← Volver
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
