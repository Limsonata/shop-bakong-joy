// Product/collection data layer with automatic backend selection.
// Uses Supabase when configured, falls back to local JSON file otherwise.
// In demo mode, admin mutations are persisted to localStorage as an overlay
// on top of the bundled JSON so the editor UI is fully usable without Supabase.
import productsData from "@/data/products.json";
import { supabase, isSupabaseConfigured, type DbProduct } from "./supabase";

export interface Product {
  id: string;
  title: string;
  description: string;
  handle: string;
  productType: string;
  price: { amount: string; currencyCode: string };
  images: Array<{ url: string; altText: string | null }>;
  variants: Array<{
    id: string;
    title: string;
    price: { amount: string; currencyCode: string };
    availableForSale: boolean;
    selectedOptions: Array<{ name: string; value: string }>;
  }>;
  collections: string[];
}

export interface Collection {
  id: string;
  title: string;
  handle: string;
  description: string;
}

export interface ProductEdge {
  node: Product;
}

export interface CollectionEdge {
  node: Collection;
}

// ---------- Helpers ----------
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const isBrowser = typeof window !== "undefined";
const PRODUCTS_OVERLAY_KEY = "demo-products-overlay";

interface DemoOverlay {
  added: Product[];
  updated: Record<string, Partial<Product>>;
  deleted: string[];
}

function getOverlay(): DemoOverlay {
  if (!isBrowser) return { added: [], updated: {}, deleted: [] };
  const stored = localStorage.getItem(PRODUCTS_OVERLAY_KEY);
  if (!stored) return { added: [], updated: {}, deleted: [] };
  try {
    return JSON.parse(stored);
  } catch {
    return { added: [], updated: {}, deleted: [] };
  }
}

function saveOverlay(overlay: DemoOverlay): void {
  if (!isBrowser) return;
  localStorage.setItem(PRODUCTS_OVERLAY_KEY, JSON.stringify(overlay));
}

/** Apply the demo overlay to the bundled JSON to produce the effective product list. */
function getDemoProducts(): Product[] {
  const overlay = getOverlay();
  const base = productsData.products as Product[];
  const merged = base
    .filter((p) => !overlay.deleted.includes(p.id))
    .map((p) => {
      const updates = overlay.updated[p.id];
      return updates ? { ...p, ...updates } : p;
    });
  return [...overlay.added, ...merged];
}

function dbProductToProduct(row: DbProduct): Product {
  const price = { amount: String(row.price), currencyCode: row.currency || "USD" };
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    handle: row.handle,
    productType: row.product_type ?? "",
    price,
    images: row.image_url ? [{ url: row.image_url, altText: row.title }] : [],
    variants: [
      {
        id: `${row.id}-default`,
        title: "Default",
        price,
        availableForSale: row.in_stock,
        selectedOptions: [],
      },
    ],
    collections: row.collections ?? [],
  };
}

// ---------- Public API ----------

export async function getProducts(options?: {
  first?: number;
  query?: string | null;
}): Promise<ProductEdge[]> {
  if (isSupabaseConfigured && supabase) {
    let q = supabase.from("products").select("*").order("created_at", { ascending: false });
    if (options?.first) q = q.limit(options.first);
    if (options?.query) {
      const term = options.query;
      q = q.or(
        `title.ilike.%${term}%,description.ilike.%${term}%,product_type.ilike.%${term}%`,
      );
    }
    const { data, error } = await q;
    if (error) {
      console.error("Supabase getProducts error:", error);
      return [];
    }
    return (data ?? []).map((row) => ({ node: dbProductToProduct(row as DbProduct) }));
  }

  await delay(120);
  let products = getDemoProducts();
  if (options?.query) {
    const query = options.query.toLowerCase();
    products = products.filter(
      (p) =>
        p.title.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.productType.toLowerCase().includes(query) ||
        p.collections.some((c) => c.toLowerCase().includes(query)),
    );
  }
  if (options?.first) products = products.slice(0, options.first);
  return products.map((node) => ({ node }));
}

export async function getProductByHandle(handle: string): Promise<Product | null> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("handle", handle)
      .maybeSingle();
    if (error || !data) return null;
    return dbProductToProduct(data as DbProduct);
  }

  await delay(80);
  return getDemoProducts().find((p) => p.handle === handle) ?? null;
}

export async function getProductById(id: string): Promise<Product | null> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    return dbProductToProduct(data as DbProduct);
  }

  await delay(80);
  return getDemoProducts().find((p) => p.id === id) ?? null;
}

export async function getCollections(options?: {
  first?: number;
}): Promise<CollectionEdge[]> {
  await delay(60);
  let collections = productsData.collections as Collection[];
  if (options?.first) collections = collections.slice(0, options.first);
  return collections.map((node) => ({ node }));
}

export async function getProductTypes(): Promise<string[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from("products").select("product_type");
    if (error || !data) return [];
    const types = new Set<string>();
    data.forEach((row: { product_type: string | null }) => {
      if (row.product_type) types.add(row.product_type);
    });
    return Array.from(types).sort();
  }

  await delay(40);
  const types = new Set<string>();
  getDemoProducts().forEach((p) => {
    if (p.productType) types.add(p.productType);
  });
  return Array.from(types).sort();
}

// ---------- Admin mutations ----------

export interface ProductInput {
  handle: string;
  title: string;
  description: string;
  productType: string;
  price: number;
  currency: string;
  imageUrl: string;
  inStock: boolean;
  collections: string[];
}

export async function createProduct(input: ProductInput): Promise<Product> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("products")
      .insert({
        handle: input.handle,
        title: input.title,
        description: input.description,
        product_type: input.productType,
        price: input.price,
        currency: input.currency,
        image_url: input.imageUrl,
        in_stock: input.inStock,
        collections: input.collections,
      })
      .select("*")
      .single();
    if (error || !data) {
      throw new Error(error?.message || "Failed to create product");
    }
    return dbProductToProduct(data as DbProduct);
  }

  // Demo mode: persist to localStorage overlay
  await delay(120);
  const newProduct: Product = {
    id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    handle: input.handle,
    title: input.title,
    description: input.description,
    productType: input.productType,
    price: { amount: input.price.toFixed(2), currencyCode: input.currency },
    images: input.imageUrl ? [{ url: input.imageUrl, altText: input.title }] : [],
    variants: [
      {
        id: `${input.handle}-default`,
        title: "Default",
        price: { amount: input.price.toFixed(2), currencyCode: input.currency },
        availableForSale: input.inStock,
        selectedOptions: [],
      },
    ],
    collections: input.collections,
  };
  const overlay = getOverlay();
  overlay.added.unshift(newProduct);
  saveOverlay(overlay);
  return newProduct;
}

export async function updateProduct(id: string, input: ProductInput): Promise<Product> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("products")
      .update({
        handle: input.handle,
        title: input.title,
        description: input.description,
        product_type: input.productType,
        price: input.price,
        currency: input.currency,
        image_url: input.imageUrl,
        in_stock: input.inStock,
        collections: input.collections,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) {
      throw new Error(error?.message || "Failed to update product");
    }
    return dbProductToProduct(data as DbProduct);
  }

  await delay(120);
  const overlay = getOverlay();
  const updates: Partial<Product> = {
    handle: input.handle,
    title: input.title,
    description: input.description,
    productType: input.productType,
    price: { amount: input.price.toFixed(2), currencyCode: input.currency },
    images: input.imageUrl ? [{ url: input.imageUrl, altText: input.title }] : [],
    collections: input.collections,
  };

  // If it's an added product, update it in place
  const addedIdx = overlay.added.findIndex((p) => p.id === id);
  if (addedIdx >= 0) {
    overlay.added[addedIdx] = {
      ...overlay.added[addedIdx],
      ...updates,
      variants: [
        {
          ...overlay.added[addedIdx].variants[0],
          price: updates.price!,
          availableForSale: input.inStock,
        },
      ],
    };
    saveOverlay(overlay);
    return overlay.added[addedIdx];
  }

  // Otherwise it's an existing JSON product - record the override
  overlay.updated[id] = {
    ...(overlay.updated[id] || {}),
    ...updates,
    variants: [
      {
        id: `${input.handle}-default`,
        title: "Default",
        price: updates.price!,
        availableForSale: input.inStock,
        selectedOptions: [],
      },
    ],
  };
  saveOverlay(overlay);

  const product = getDemoProducts().find((p) => p.id === id);
  if (!product) throw new Error("Product not found after update");
  return product;
}

export async function deleteProduct(id: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from("products").delete().eq("id", id);
    return !error;
  }

  await delay(100);
  const overlay = getOverlay();
  const addedIdx = overlay.added.findIndex((p) => p.id === id);
  if (addedIdx >= 0) {
    overlay.added.splice(addedIdx, 1);
  } else {
    if (!overlay.deleted.includes(id)) overlay.deleted.push(id);
  }
  delete overlay.updated[id];
  saveOverlay(overlay);
  return true;
}
