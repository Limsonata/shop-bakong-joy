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
  const dbVariants = row.variants && row.variants.length > 0 ? row.variants : null;
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    handle: row.handle,
    productType: row.product_type ?? "",
    price,
    images: row.image_url ? [{ url: row.image_url, altText: row.title }] : [],
    variants: dbVariants
      ? dbVariants.map((v) => ({
          id: v.id,
          title: v.title,
          price: { amount: String(v.price), currencyCode: row.currency || "USD" },
          availableForSale: v.availableForSale,
          selectedOptions: [{ name: v.option, value: v.title }],
        }))
      : [
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
      q = q.or(`title.ilike.%${term}%,description.ilike.%${term}%,product_type.ilike.%${term}%`);
    }
    const { data, error } = await q;
    if (error) {
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
    const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
    if (error || !data) return null;
    return dbProductToProduct(data as DbProduct);
  }

  await delay(80);
  return getDemoProducts().find((p) => p.id === id) ?? null;
}

export async function getCollections(options?: { first?: number }): Promise<CollectionEdge[]> {
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

export interface ProductVariantInput {
  title: string;
  option: string; // "Size" or "Color"
  price: number;
  availableForSale: boolean;
}

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
  variants: ProductVariantInput[];
}

function productInputToDbRow(
  input: ProductInput,
  includeVariants: boolean,
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    handle: input.handle,
    title: input.title,
    description: input.description,
    product_type: input.productType,
    price: input.price,
    currency: input.currency,
    image_url: input.imageUrl,
    in_stock: input.inStock,
    collections: input.collections,
  };

  if (includeVariants) {
    row.variants = input.variants.map((variant, index) => ({
      id: `${input.handle}-v${index}`,
      ...variant,
    }));
  }

  return row;
}

function isMissingColumnError(error: unknown, column: string): boolean {
  if (!error || typeof error !== "object") return false;
  const postgrestError = error as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  };
  const errorText = [
    postgrestError.code,
    postgrestError.message,
    postgrestError.details,
    postgrestError.hint,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    errorText.includes(column.toLowerCase()) &&
    (errorText.includes("column") || errorText.includes("schema cache"))
  );
}

export async function createProduct(input: ProductInput): Promise<Product> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("products")
      .insert(productInputToDbRow(input, true))
      .select("*")
      .single();

    if (error && isMissingColumnError(error, "variants")) {
      const fallback = await supabase
        .from("products")
        .insert(productInputToDbRow(input, false))
        .select("*")
        .single();
      if (fallback.error || !fallback.data) {
        throw new Error(fallback.error?.message || "Failed to create product");
      }
      return dbProductToProduct(fallback.data as DbProduct);
    }

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
      ...(input.variants.length > 0
        ? input.variants.map((variant, index) => ({
            id: `${input.handle}-v${index}`,
            title: variant.title,
            price: { amount: variant.price.toFixed(2), currencyCode: input.currency },
            availableForSale: variant.availableForSale,
            selectedOptions: [{ name: variant.option, value: variant.title }],
          }))
        : [
            {
              id: `${input.handle}-default`,
              title: "Default",
              price: { amount: input.price.toFixed(2), currencyCode: input.currency },
              availableForSale: input.inStock,
              selectedOptions: [],
            },
          ]),
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
      .update(productInputToDbRow(input, true))
      .eq("id", id)
      .select("*")
      .single();

    if (error && isMissingColumnError(error, "variants")) {
      const fallback = await supabase
        .from("products")
        .update(productInputToDbRow(input, false))
        .eq("id", id)
        .select("*")
        .single();
      if (fallback.error || !fallback.data) {
        throw new Error(fallback.error?.message || "Failed to update product");
      }
      return dbProductToProduct(fallback.data as DbProduct);
    }

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
    variants:
      input.variants.length > 0
        ? input.variants.map((variant, index) => ({
            id: `${input.handle}-v${index}`,
            title: variant.title,
            price: { amount: variant.price.toFixed(2), currencyCode: input.currency },
            availableForSale: variant.availableForSale,
            selectedOptions: [{ name: variant.option, value: variant.title }],
          }))
        : [
            {
              id: `${input.handle}-default`,
              title: "Default",
              price: { amount: input.price.toFixed(2), currencyCode: input.currency },
              availableForSale: input.inStock,
              selectedOptions: [],
            },
          ],
  };

  // If it's an added product, update it in place
  const addedIdx = overlay.added.findIndex((p) => p.id === id);
  if (addedIdx >= 0) {
    overlay.added[addedIdx] = {
      ...overlay.added[addedIdx],
      ...updates,
    };
    saveOverlay(overlay);
    return overlay.added[addedIdx];
  }

  // Otherwise it's an existing JSON product - record the override
  overlay.updated[id] = {
    ...(overlay.updated[id] || {}),
    ...updates,
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

// ---------- Collection CRUD ----------

const COLLECTIONS_OVERLAY_KEY = "demo-collections-overlay";

interface CollectionsOverlay {
  added: Collection[];
  updated: Record<string, Partial<Collection>>;
  deleted: string[];
}

function getCollectionsOverlay(): CollectionsOverlay {
  if (!isBrowser) return { added: [], updated: {}, deleted: [] };
  const stored = localStorage.getItem(COLLECTIONS_OVERLAY_KEY);
  if (!stored) return { added: [], updated: {}, deleted: [] };
  try {
    return JSON.parse(stored);
  } catch {
    return { added: [], updated: {}, deleted: [] };
  }
}

function saveCollectionsOverlay(overlay: CollectionsOverlay): void {
  if (!isBrowser) return;
  localStorage.setItem(COLLECTIONS_OVERLAY_KEY, JSON.stringify(overlay));
}

function dbCollectionToCollection(row: {
  id: string;
  title: string;
  handle: string;
  description: string | null;
}): Collection {
  return {
    id: row.id,
    title: row.title,
    handle: row.handle,
    description: row.description ?? "",
  };
}

function generateHandle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function getAllCollections(): Promise<Collection[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from("collections").select("*").order("title");
    if (error || !data) {
      return [];
    }
    return data.map((row) => dbCollectionToCollection(row));
  }

  await delay(60);
  const overlay = getCollectionsOverlay();
  const base = productsData.collections as Collection[];
  const merged = base
    .filter((c) => !overlay.deleted.includes(c.id))
    .map((c) => {
      const updates = overlay.updated[c.id];
      return updates ? { ...c, ...updates } : c;
    });
  return [...overlay.added, ...merged];
}

export interface CreateCollectionInput {
  title: string;
  description?: string;
}

export async function createCollection(input: CreateCollectionInput): Promise<Collection> {
  const handle = generateHandle(input.title);

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("collections")
      .insert({
        title: input.title,
        handle,
        description: input.description || "",
      })
      .select("*")
      .single();
    if (error || !data) {
      throw new Error(error?.message || "Failed to create collection");
    }
    return dbCollectionToCollection(data);
  }

  await delay(100);
  const newCollection: Collection = {
    id: `col-demo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: input.title,
    handle,
    description: input.description || "",
  };
  const overlay = getCollectionsOverlay();
  overlay.added.unshift(newCollection);
  saveCollectionsOverlay(overlay);
  return newCollection;
}

export interface UpdateCollectionInput {
  title?: string;
  description?: string;
}

export async function updateCollection(
  id: string,
  input: UpdateCollectionInput,
): Promise<Collection> {
  const updates: Partial<Collection> = {};
  if (input.title !== undefined) {
    updates.title = input.title;
    updates.handle = generateHandle(input.title);
  }
  if (input.description !== undefined) {
    updates.description = input.description;
  }

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("collections")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) {
      throw new Error(error?.message || "Failed to update collection");
    }
    return dbCollectionToCollection(data);
  }

  await delay(100);
  const overlay = getCollectionsOverlay();
  const addedIdx = overlay.added.findIndex((c) => c.id === id);

  if (addedIdx >= 0) {
    overlay.added[addedIdx] = { ...overlay.added[addedIdx], ...updates };
    saveCollectionsOverlay(overlay);
    return overlay.added[addedIdx];
  }

  overlay.updated[id] = { ...(overlay.updated[id] || {}), ...updates };
  saveCollectionsOverlay(overlay);

  const collection = (await getAllCollections()).find((c) => c.id === id);
  if (!collection) throw new Error("Collection not found after update");
  return collection;
}

export async function deleteCollection(id: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    // Check if any products use this collection
    const { data: productsWithCollection } = await supabase
      .from("products")
      .select("id")
      .contains("collections", [id]);

    if (productsWithCollection && productsWithCollection.length > 0) {
      throw new Error(
        `Cannot delete collection: ${productsWithCollection.length} product(s) are using it`,
      );
    }

    const { error } = await supabase.from("collections").delete().eq("id", id);
    return !error;
  }

  await delay(80);
  const overlay = getCollectionsOverlay();
  const addedIdx = overlay.added.findIndex((c) => c.id === id);
  if (addedIdx >= 0) {
    overlay.added.splice(addedIdx, 1);
  } else {
    // Check if any products use this collection in demo mode
    const products = getDemoProducts();
    const productsUsingCollection = products.filter((p) => p.collections.includes(id));
    if (productsUsingCollection.length > 0) {
      throw new Error(
        `Cannot delete collection: ${productsUsingCollection.length} product(s) are using it`,
      );
    }
    if (!overlay.deleted.includes(id)) overlay.deleted.push(id);
  }
  delete overlay.updated[id];
  saveCollectionsOverlay(overlay);
  return true;
}

export async function getCollectionById(id: string): Promise<Collection | null> {
  const collections = await getAllCollections();
  return collections.find((c) => c.id === id) || null;
}

export async function getProductsInCollection(collectionId: string): Promise<Product[]> {
  const allProducts = await getProducts();
  return allProducts.map((p) => p.node).filter((p) => p.collections.includes(collectionId));
}

export async function updateProductCollections(
  productId: string,
  collectionIds: string[],
): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from("products")
      .update({ collections: collectionIds })
      .eq("id", productId);
    if (error) {
      throw new Error(error.message);
    }
    return;
  }

  await delay(80);
  const overlay = getOverlay();
  const addedIdx = overlay.added.findIndex((p) => p.id === productId);

  if (addedIdx >= 0) {
    overlay.added[addedIdx].collections = collectionIds;
  } else {
    overlay.updated[productId] = {
      ...(overlay.updated[productId] || {}),
      collections: collectionIds,
    };
  }
  saveOverlay(overlay);
}
