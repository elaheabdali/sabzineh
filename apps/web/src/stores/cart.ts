"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { products } from "@/data/seed";

export interface CartLine {
  productId: string;
  qty: number;
}

interface CartState {
  lines: CartLine[];
  add: (productId: string, qty?: number) => void;
  remove: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  clear: () => void;
  count: () => number;
  /** Server-trusted subtotal is computed at checkout; this is display-only. */
  subtotal: () => number;
}

/**
 * Cart store (Zustand + persist). Storage is SSR-safe: on the server
 * an in-memory shim is used and nothing touches localStorage.
 */
const ssrSafeStorage = () => {
  if (typeof window === "undefined") {
    const memory = new Map<string, string>();
    return {
      getItem: (name: string) => memory.get(name) ?? null,
      setItem: (name: string, value: string) => {
        memory.set(name, value);
      },
      removeItem: (name: string) => {
        memory.delete(name);
      },
    };
  }
  return localStorage;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      add: (productId, qty = 1) =>
        set((state) => {
          const existing = state.lines.find((l) => l.productId === productId);
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.productId === productId ? { ...l, qty: Math.min(99, l.qty + qty) } : l,
              ),
            };
          }
          return { lines: [...state.lines, { productId, qty: Math.min(99, qty) }] };
        }),
      remove: (productId) =>
        set((state) => ({ lines: state.lines.filter((l) => l.productId !== productId) })),
      setQty: (productId, qty) =>
        set((state) =>
          qty <= 0
            ? { lines: state.lines.filter((l) => l.productId !== productId) }
            : {
                lines: state.lines.map((l) =>
                  l.productId === productId ? { ...l, qty: Math.min(99, qty) } : l,
                ),
              },
        ),
      clear: () => set({ lines: [] }),
      count: () => get().lines.reduce((sum, l) => sum + l.qty, 0),
      subtotal: () =>
        get().lines.reduce((sum, l) => {
          const product = products.find((p) => p.id === l.productId);
          return sum + (product ? product.price * l.qty : 0);
        }, 0),
    }),
    {
      name: "sabzineh-cart",
      storage: createJSONStorage(ssrSafeStorage),
    },
  ),
);
