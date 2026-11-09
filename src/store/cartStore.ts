import { create } from "zustand";
import { CartItem, Product } from "@/lib/types";

/**
 * Carrito de la tienda. Un mismo café puede estar dos veces con distinta molienda, así que
 * cada línea se identifica por café + molienda (antes quitar una línea borraba las dos).
 */
interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  addItem: (product: Product, grind: string) => void;
  removeItem: (id: string, grind: string) => void;
  updateQuantity: (id: string, grind: string, quantity: number) => void;
  clearCart: () => void;
  toggleCart: () => void;
  total: () => number;
  itemCount: () => number;
}

const misma = (i: CartItem, id: string, grind: string) => i.id === id && i.selectedGrind === grind;

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  isOpen: false,
  addItem: (product, grind) => {
    const existe = get().items.some((i) => misma(i, product.id, grind));
    set((s) => ({
      items: existe
        ? s.items.map((i) => (misma(i, product.id, grind) ? { ...i, quantity: i.quantity + 1 } : i))
        : [...s.items, { ...product, quantity: 1, selectedGrind: grind }],
    }));
  },
  removeItem: (id, grind) => set((s) => ({ items: s.items.filter((i) => !misma(i, id, grind)) })),
  updateQuantity: (id, grind, quantity) =>
    set((s) => ({
      items:
        quantity <= 0
          ? s.items.filter((i) => !misma(i, id, grind))
          : s.items.map((i) => (misma(i, id, grind) ? { ...i, quantity } : i)),
    })),
  clearCart: () => set({ items: [] }),
  toggleCart: () => set((s) => ({ isOpen: !s.isOpen })),
  total: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
  itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
}));
