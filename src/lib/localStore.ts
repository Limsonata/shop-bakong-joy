// Compatibility layer. New code should import from "@/lib/productStore" directly.
// This file keeps the cart helpers and re-exports product/collection helpers
// so existing imports keep working.
export {
  getProducts,
  getProductByHandle,
  getCollections,
  getProductTypes,
  type Product as LocalProduct,
  type Collection as LocalCollection,
  type ProductEdge as LocalProductEdge,
  type CollectionEdge as LocalCollectionEdge,
} from "./productStore";

import type { ProductEdge } from "./productStore";

// Cart management (localStorage based)
export interface CartItem {
  lineId: string;
  product: ProductEdge;
  variantId: string;
  variantTitle: string;
  price: { amount: string; currencyCode: string };
  quantity: number;
  selectedOptions: Array<{ name: string; value: string }>;
}

interface LocalCart {
  id: string;
  items: CartItem[];
  createdAt: number;
}

const CART_STORAGE_KEY = "local-cart";
const isBrowser = typeof window !== "undefined";

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function getLocalCart(): LocalCart {
  if (!isBrowser) {
    return { id: "ssr", items: [], createdAt: Date.now() };
  }
  const stored = localStorage.getItem(CART_STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // Invalid data, create new cart
    }
  }

  const newCart: LocalCart = {
    id: `cart-${Date.now()}`,
    items: [],
    createdAt: Date.now(),
  };
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(newCart));
  return newCart;
}

export function saveLocalCart(cart: LocalCart): void {
  if (!isBrowser) return;
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch (err) {
    if (err instanceof DOMException && err.name === "QuotaExceededError") {
      // Storage full — clear the cart to recover rather than silently failing
      const empty: LocalCart = { id: cart.id, items: [], createdAt: cart.createdAt };
      try { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(empty)); } catch { /* ignore */ }
    }
  }
}

export async function addToCart(item: Omit<CartItem, "lineId">): Promise<CartItem> {
  await delay(80);
  const cart = getLocalCart();
  const existingItem = cart.items.find((i) => i.variantId === item.variantId);

  if (existingItem) {
    existingItem.quantity += item.quantity;
  } else {
    const newItem: CartItem = {
      ...item,
      lineId: `line-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    };
    cart.items.push(newItem);
  }

  saveLocalCart(cart);
  return existingItem || cart.items[cart.items.length - 1];
}

export async function updateCartItem(variantId: string, quantity: number): Promise<boolean> {
  await delay(80);
  const cart = getLocalCart();
  const item = cart.items.find((i) => i.variantId === variantId);
  if (!item) return false;

  if (quantity <= 0) {
    cart.items = cart.items.filter((i) => i.variantId !== variantId);
  } else {
    item.quantity = quantity;
  }

  saveLocalCart(cart);
  return true;
}

export async function removeFromCart(variantId: string): Promise<boolean> {
  await delay(80);
  const cart = getLocalCart();
  cart.items = cart.items.filter((i) => i.variantId !== variantId);
  saveLocalCart(cart);
  return true;
}

export function clearCart(): void {
  const newCart: LocalCart = {
    id: `cart-${Date.now()}`,
    items: [],
    createdAt: Date.now(),
  };
  saveLocalCart(newCart);
}
