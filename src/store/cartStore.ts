import { create } from "zustand";
import { CartItem, Product } from "@/lib/types";

interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  addItem: (product: Product, grind: string) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  toggleCart: () => void;
  total: () => number;
  itemCount: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  isOpen: false,
  addItem: (product, grind) => {
    const existing = get().items.find(
      (i) => i.id === product.id && i.selectedGrind === grind
    );
    if (existing) {
      set((s) => ({
        items: s.items.map((i) =>
          i.id === product.id && i.selectedGrind === grind
            ? { ...i, quantity: i.quantity + 1 }
            : i
        ),
      }));
    } else {
      set((s) => ({
        items: [...s.items, { ...product, quantity: 1, selectedGrind: grind }],
      }));
    }
  },
  removeItem: (id) =>
    set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
  updateQuantity: (id, quantity) =>
    set((s) => ({
      items:
        quantity <= 0
          ? s.items.filter((i) => i.id !== id)
          : s.items.map((i) => (i.id === id ? { ...i, quantity } : i)),
    })),
  clearCart: () => set({ items: [] }),
  toggleCart: () => set((s) => ({ isOpen: !s.isOpen })),
  total: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
  itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
}));
