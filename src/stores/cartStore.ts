import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { LocalProductEdge } from "@/lib/localStore";
import {
  addToCart as localAddToCart,
  clearCart as localClearCart,
  getLocalCart,
  removeFromCart as localRemoveFromCart,
  updateCartItem as localUpdateCartItem,
} from "@/lib/localStore";
import { getPayWayCheckoutUrl } from "@/lib/payway";

export interface CartItem {
  lineId: string;
  product: LocalProductEdge;
  variantId: string;
  variantTitle: string;
  price: { amount: string; currencyCode: string };
  quantity: number;
  selectedOptions: Array<{ name: string; value: string }>;
}

interface CartStore {
  items: CartItem[];
  cartId: string | null;
  checkoutUrl: string | null;
  isLoading: boolean;
  isSyncing: boolean;
  addItem: (item: Omit<CartItem, "lineId">) => Promise<void>;
  updateQuantity: (variantId: string, quantity: number) => Promise<void>;
  removeItem: (variantId: string) => Promise<void>;
  clearCart: () => void;
  syncCart: () => Promise<void>;
  getCheckoutUrl: () => string | null;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      cartId: null,
      checkoutUrl: null,
      isLoading: false,
      isSyncing: false,

      addItem: async (item) => {
        set({ isLoading: true });
        try {
          await localAddToCart(item);
          const cart = getLocalCart();
          set({
            items: cart.items,
            cartId: cart.id,
            checkoutUrl: getPayWayCheckoutUrl(),
          });
        } catch {
          // Silently fail - cart operations are not critical
        } finally {
          set({ isLoading: false });
        }
      },

      updateQuantity: async (variantId, quantity) => {
        set({ isLoading: true });
        try {
          await localUpdateCartItem(variantId, quantity);
          const cart = getLocalCart();
          set({ items: cart.items });
        } catch {
          // Silently fail - cart operations are not critical
        } finally {
          set({ isLoading: false });
        }
      },

      removeItem: async (variantId) => {
        set({ isLoading: true });
        try {
          await localRemoveFromCart(variantId);
          const cart = getLocalCart();
          set({ items: cart.items });
        } catch {
          // Silently fail - cart operations are not critical
        } finally {
          set({ isLoading: false });
        }
      },

      clearCart: () => {
        localClearCart();
        set({ items: [], cartId: null, checkoutUrl: null });
      },

      getCheckoutUrl: () => get().checkoutUrl,

      syncCart: async () => {
        const { isSyncing } = get();
        if (isSyncing) return;
        set({ isSyncing: true });
        try {
          const cart = getLocalCart();
          set({
            items: cart.items,
            cartId: cart.id,
            checkoutUrl: cart.items.length > 0 ? getPayWayCheckoutUrl() : null,
          });
        } catch {
          // Silently fail - cart sync is not critical
        } finally {
          set({ isSyncing: false });
        }
      },
    }),
    {
      name: "bakong-cart-store",
      storage: createJSONStorage(() => localStorage),
      // items are already persisted in "local-cart" by localStore.ts and
      // reloaded via syncCart() on mount — no need to duplicate them here.
      partialize: (state) => ({
        cartId: state.cartId,
        checkoutUrl: state.checkoutUrl,
      }),
    },
  ),
);
