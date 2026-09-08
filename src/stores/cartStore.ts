// Cart state — single source of truth.
// Items live here and are persisted once under the "bakong-cart-store"
// localStorage key (via zustand persist). The old double-storage setup
// ("local-cart" + a manual syncCart copy) has been removed; existing carts
// in "local-cart" are migrated automatically on first load.
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ProductEdge } from "@/lib/productStore";

export const CHECKOUT_URL = "/checkout/bakong";

export interface CartItem {
  lineId: string;
  product: ProductEdge;
  variantId: string;
  variantTitle: string;
  price: { amount: string; currencyCode: string };
  quantity: number;
  selectedOptions: Array<{ name: string; value: string }>;
}

interface CartStore {
  items: CartItem[];
  isLoading: boolean;
  isSyncing: boolean;
  addItem: (item: Omit<CartItem, "lineId">) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  clearCart: () => void;
  /** Kept for API compatibility — hydration + migration happen via persist. */
  syncCart: () => Promise<void>;
  getCheckoutUrl: () => string | null;
}

function newLineId(): string {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** One-time rescue of carts saved by the old double-storage implementation. */
function readLegacyCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("local-cart");
    if (!raw) return [];
    const cart = JSON.parse(raw) as { items?: CartItem[] };
    return Array.isArray(cart.items) ? cart.items : [];
  } catch {
    return [];
  }
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,
      isSyncing: false,

      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((i) => i.variantId === item.variantId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.variantId === item.variantId ? { ...i, quantity: i.quantity + item.quantity } : i,
              ),
            };
          }
          return { items: [...state.items, { ...item, lineId: newLineId() }] };
        }),

      updateQuantity: (variantId, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.variantId !== variantId)
              : state.items.map((i) => (i.variantId === variantId ? { ...i, quantity } : i)),
        })),

      removeItem: (variantId) =>
        set((state) => ({ items: state.items.filter((i) => i.variantId !== variantId) })),

      clearCart: () => set({ items: [] }),

      syncCart: async () => {
        // Persist middleware keeps localStorage in sync automatically.
        // This remains a no-op so existing callers (useCartSync, CartDrawer) work.
        void get();
      },

      getCheckoutUrl: () => (get().items.length > 0 ? CHECKOUT_URL : null),
    }),
    {
      name: "bakong-cart-store",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
      // v1 stored only cartId/checkoutUrl and kept items in "local-cart".
      migrate: (persisted) => {
        const items =
          persisted && Array.isArray((persisted as { items?: CartItem[] }).items)
            ? ((persisted as { items: CartItem[] }).items ?? [])
            : [];
        return { items: items.length > 0 ? items : readLegacyCart() };
      },
    },
  ),
);
