// Product/collection data layer backed by Supabase.
import { supabase, type DbProduct } from "./supabase";
import { getSupabaseAccessToken } from "./authToken";
import {
  createAdminCollection,
  createAdminProduct,
  deleteAdminCollection,
  deleteAdminProduct,
  updateAdminCollection,
  updateAdminProduct,
  updateAdminProductCollections,
} from "./api/security.functions";

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
function db() {
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
}

function dbProductToProduct(row: DbProduct): Product {
  const price = { amount: String(row.price), currencyCode: row.currency || "USD" };
  const dbVariants = row.variants && row.variants.length > 0 ? row.variants : null;
  // Gallery: `images` is the source of truth; fall back to the legacy single
  // `image_url` column for products saved before multi-image support.
  const urls = (row.images ?? []).filter(Boolean);
  const imageUrls = urls.length > 0 ? urls : row.image_url ? [row.image_url] : [];
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    handle: row.handle,
    productType: row.product_type ?? "",
    price,
    images: imageUrls.map((url) => ({ url, altText: row.title })),
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
            id: `${row.handle}-default`,
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
  /** Storefront use: hide drafts (Published = off). Admin pages see everything. */
  onlyPublished?: boolean;
}): Promise<ProductEdge[]> {
  let q = db().from("products").select("*").order("created_at", { ascending: false });
  if (options?.onlyPublished) q = q.eq("in_stock", true);
  if (options?.first) q = q.limit(options.first);
  if (options?.query) {
    const term = options.query;
    q = q.or(`title.ilike.%${term}%,description.ilike.%${term}%,product_type.ilike.%${term}%`);
  }
  const { data, error } = await q;
  if (error) {
    throw new Error(`Failed to load products: ${error.message}`);
  }
  return (data ?? []).map((row) => ({ node: dbProductToProduct(row as DbProduct) }));
}

export async function getProductByHandle(handle: string): Promise<Product | null> {
  const { data, error } = await db()
    .from("products")
    .select("*")
    .eq("handle", handle)
    .maybeSingle();
  // Unpublished (draft) products are hidden from the website entirely.
  if (error || !data || !data.in_stock) return null;
  return dbProductToProduct(data as DbProduct);
}

export async function getProductById(id: string): Promise<Product | null> {
  const { data, error } = await db().from("products").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return dbProductToProduct(data as DbProduct);
}

export async function getCollections(options?: { first?: number }): Promise<CollectionEdge[]> {
  let q = db().from("collections").select("*").order("title");
  if (options?.first) q = q.limit(options.first);
  const { data, error } = await q;
  if (error) {
    throw new Error(`Failed to load collections: ${error.message}`);
  }
  return (data ?? []).map((row) => ({ node: dbCollectionToCollection(row) }));
}

export async function getProductTypes(): Promise<string[]> {
  const { data, error } = await db().from("products").select("product_type");
  if (error) throw new Error(`Failed to load product types: ${error.message}`);
  const types = new Set<string>();
  (data ?? []).forEach((row: { product_type: string | null }) => {
    if (row.product_type) types.add(row.product_type);
  });
  return Array.from(types).sort();
}

// ---------- Admin mutations ----------

export interface ProductVariantInput {
  title: string;
  option: string; // "Size" or "Color"
  price: number;
  availableForSale: boolean;
  /** Starting stock for this variant — creates the linked stock row's first quantity. */
  stock?: number;
}

export interface ProductInput {
  handle: string;
  title: string;
  description: string;
  productType: string;
  price: number;
  currency: string;
  /** Gallery images, first = main. `imageUrl` (legacy single image) is kept in sync. */
  images?: string[];
  imageUrl?: string;
  inStock: boolean;
  collections: string[];
  variants: ProductVariantInput[];
  /** Optional: unit cost from the supplier — seeds the linked POS stock rows. */
  cost?: number;
  /** Optional: units on the shelf right now — recorded as the first stock movement. */
  stockIn?: number;
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const accessToken = await getSupabaseAccessToken();
  const data = await createAdminProduct({ data: { accessToken, input } });
  return dbProductToProduct(data as DbProduct);
}

export async function updateProduct(id: string, input: ProductInput): Promise<Product> {
  const accessToken = await getSupabaseAccessToken();
  const data = await updateAdminProduct({ data: { accessToken, id, input } });
  return dbProductToProduct(data as DbProduct);
}

export async function deleteProduct(id: string): Promise<boolean> {
  try {
    const accessToken = await getSupabaseAccessToken();
    await deleteAdminProduct({ data: { accessToken, id } });
    return true;
  } catch {
    return false;
  }
}

// ---------- Collection CRUD ----------

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

export async function getAllCollections(): Promise<Collection[]> {
  const { data, error } = await db().from("collections").select("*").order("title");
  if (error) {
    throw new Error(`Failed to load collections: ${error.message}`);
  }
  return (data ?? []).map((row) => dbCollectionToCollection(row));
}

export interface CreateCollectionInput {
  title: string;
  description?: string;
}

export async function createCollection(input: CreateCollectionInput): Promise<Collection> {
  const accessToken = await getSupabaseAccessToken();
  const data = await createAdminCollection({ data: { accessToken, input } });
  return dbCollectionToCollection(data);
}

export interface UpdateCollectionInput {
  title?: string;
  description?: string;
}

export async function updateCollection(
  id: string,
  input: UpdateCollectionInput,
): Promise<Collection> {
  const accessToken = await getSupabaseAccessToken();
  const data = await updateAdminCollection({ data: { accessToken, id, input } });
  return dbCollectionToCollection(data);
}

export async function deleteCollection(id: string): Promise<boolean> {
  try {
    const accessToken = await getSupabaseAccessToken();
    await deleteAdminCollection({ data: { accessToken, id } });
    return true;
  } catch {
    return false;
  }
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
  const accessToken = await getSupabaseAccessToken();
  await updateAdminProductCollections({ data: { accessToken, productId, collectionIds } });
}
