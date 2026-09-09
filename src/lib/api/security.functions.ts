import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { AuthResult, User, UserRole } from "@/lib/auth";
import type {
  CreateCollectionInput,
  ProductInput,
  UpdateCollectionInput,
} from "@/lib/productStore";
import type { OrderStatus } from "@/lib/orderStore";

type ProductVariantRow = {
  id: string;
  title: string;
  option: string;
  price: number;
  availableForSale: boolean;
};

type ProductRow = {
  id: string;
  handle: string;
  title: string;
  price: number;
  currency: string;
  image_url: string | null;
  in_stock: boolean;
  variants: ProductVariantRow[] | null;
};

type SessionTokens = {
  accessToken: string;
  refreshToken: string;
};

type TelegramLoginResult = AuthResult & {
  session?: SessionTokens;
};

const tokenSchema = z.object({
  accessToken: z.string().min(1).optional().nullable(),
});

const productVariantSchema = z.object({
  title: z.string().min(1),
  option: z.string().min(1),
  price: z.number().nonnegative(),
  availableForSale: z.boolean(),
  // Starting stock for this variant — seeds the linked stock_items row.
  stock: z.number().int().min(0).optional(),
});

const productInputSchema = z.object({
  handle: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  productType: z.string(),
  price: z.number().nonnegative(),
  currency: z.string().min(1),
  imageUrl: z.string().optional(),
  images: z.array(z.string()).optional(),
  inStock: z.boolean(),
  collections: z.array(z.string()),
  variants: z.array(productVariantSchema),
  // Optional POS link fields: unit cost seeds the linked stock rows and
  // startingStock is recorded as the first stock movement.
  cost: z.number().nonnegative().optional(),
  stockIn: z.number().int().min(0).optional(),
});

const collectionInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
});

const secureOrderSchema = z.object({
  accessToken: z.string().min(1).optional().nullable(),
  customerName: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(3).max(40),
  address: z.string().trim().min(3).max(500),
  bakongReference: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[A-Z0-9-]+$/)
    .optional(),
  bakongTransactionId: z.string().trim().max(120).optional().nullable(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        variantId: z.string().min(1).optional().nullable(),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .min(1)
    .max(100),
});

const telegramUserSchema = z.object({
  id: z.number().int().positive(),
  first_name: z.string().min(1),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().optional(),
  auth_date: z.number().int().positive(),
  hash: z.string().min(1),
});

function getEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}

function getSupabaseUrl(): string {
  const value = getEnv("SUPABASE_URL") || getEnv("VITE_SUPABASE_URL");
  if (!value) throw new Error("Missing SUPABASE_URL or VITE_SUPABASE_URL");
  return value;
}

function getSupabaseAnonKey(): string {
  const value =
    getEnv("SUPABASE_PUBLISHABLE_KEY") ||
    getEnv("SUPABASE_ANON_KEY") ||
    getEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ||
    getEnv("VITE_SUPABASE_ANON_KEY");
  if (!value) throw new Error("Missing Supabase publishable/anon key");
  return value;
}

function getSupabaseServiceRoleKey(): string {
  const value = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!value) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return value;
}

function createUserClient(accessToken?: string | null): SupabaseClient {
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers },
  });
}

function createServiceClient(): SupabaseClient {
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function assertAdmin(accessToken?: string | null): Promise<string> {
  if (!accessToken) throw new Error("Authentication required");
  const supabase = createUserClient(accessToken);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(accessToken);
  if (userError || !user) throw new Error("Authentication required");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  // Surface the real reason (e.g. RLS misconfig / recursion) instead of
  // masking it as a generic "not an admin" message.
  if (profileError) {
    console.error("[assertAdmin] Could not read profile:", profileError);
    throw new Error(`Admin check failed: ${profileError.message}`);
  }
  if (profile?.role !== "admin") {
    throw new Error("Admin access required");
  }

  return user.id;
}

function productInputToDbRow(
  input: ProductInput,
  includeVariants = true,
  variantIds?: string[],
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    handle: input.handle,
    title: input.title,
    description: input.description,
    product_type: input.productType,
    price: input.price,
    currency: input.currency,
    in_stock: input.inStock,
    collections: input.collections,
  };

  // Gallery: `images` is the source of truth; `image_url` mirrors the first
  // entry so order thumbnails and old code keep working.
  const images = (input.images ?? []).filter(Boolean);
  const fallbackImage = input.imageUrl?.trim();
  const resolvedImages = images.length > 0 ? images : fallbackImage ? [fallbackImage] : [];
  row.images = resolvedImages;
  row.image_url = resolvedImages[0] ?? null;

  if (includeVariants) {
    row.variants = input.variants.map((variant, index) => {
      // `stock` is a form-only field: it seeds stock_items and is not part of
      // the stored variant shape (stock lives in the linked stock_items rows).
      const { stock: _stock, ...variantData } = variant;
      return {
        id: variantIds?.[index] ?? `${input.handle}-v${index}`,
        ...variantData,
      };
    });
  }

  return row;
}

function generateHandle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function generateOrderReference(): string {
  return `SBJ-${Date.now().toString(36).toUpperCase()}`;
}

async function getUserIdFromToken(accessToken?: string | null): Promise<string | null> {
  if (!accessToken) return null;
  const supabase = createUserClient(accessToken);
  const {
    data: { user },
  } = await supabase.auth.getUser(accessToken);
  return user?.id ?? null;
}

function selectVariant(product: ProductRow, variantId?: string | null): ProductVariantRow | null {
  if (!variantId) return null;
  return product.variants?.find((variant) => variant.id === variantId) ?? null;
}

export const createSecureOrder = createServerFn({ method: "POST" })
  .inputValidator(secureOrderSchema)
  .handler(async ({ data }) => {
    const serviceSupabase = createServiceClient();
    const productIds = [...new Set(data.items.map((item) => item.productId))];
    const { data: products, error: productsError } = await serviceSupabase
      .from("products")
      .select("id, handle, title, price, currency, image_url, in_stock, variants")
      .in("id", productIds);

    if (productsError || !products) {
      throw new Error(productsError?.message || "Unable to price order");
    }

    const productById = new Map(products.map((row) => [row.id, row as ProductRow]));
    let total = 0;
    let currency: string | null = null;

    const orderItems = data.items.map((item) => {
      const product = productById.get(item.productId);
      if (!product) throw new Error("One or more products are unavailable");
      if (!product.in_stock) throw new Error(`${product.title} is out of stock`);

      const variant = selectVariant(product, item.variantId);
      if (item.variantId && !variant) throw new Error(`${product.title} variant is unavailable`);
      if (variant && variant.availableForSale === false) {
        throw new Error(`${product.title} variant is unavailable`);
      }

      const price = Number(variant?.price ?? product.price);
      const itemCurrency = product.currency || "USD";
      if (currency && currency !== itemCurrency) {
        throw new Error("Mixed-currency orders are not supported");
      }
      currency = itemCurrency;
      total += price * item.quantity;

      return {
        productId: product.id,
        variantId: variant?.id ?? null,
        title: variant ? `${product.title} - ${variant.title}` : product.title,
        quantity: item.quantity,
        price,
        currency: itemCurrency,
        imageUrl: product.image_url ?? undefined,
      };
    });

    const userId = await getUserIdFromToken(data.accessToken);
    const reference = data.bakongReference || generateOrderReference();
    const { data: order, error: orderError } = await serviceSupabase
      .from("orders")
      .insert({
        user_id: userId,
        customer_name: data.customerName,
        phone: data.phone,
        address: data.address,
        total,
        currency: currency ?? "USD",
        bakong_reference: reference,
        bakong_transaction_id: data.bakongTransactionId || null,
        status: "pending",
        items: orderItems,
      })
      .select("*")
      .single();

    if (orderError || !order) {
      throw new Error(orderError?.message || "Failed to create order");
    }

    return order;
  });

/**
 * Handle convention shared with the stock_items→products sync trigger
 * (supabase/migrations/20260906140000_pos_storefront_sync.sql):
 * handle = slug(`${name}-${category}`). Keeping the product's handle on the
 * same convention lets the trigger link stock_items.product_id back to this
 * exact product row instead of creating a duplicate.
 */
function stockGroupHandle(name: string, category: string): string {
  const raw = `${name || "product"}-${category || "other"}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return raw.substring(0, 80) || `product-${Date.now().toString(36)}`;
}

/** Map a product variant onto the size/colour columns of stock_items. */
function variantToSizeColor(variant?: { title: string; option: string }): {
  size: string;
  color: string;
} {
  if (!variant) return { size: "Default", color: "" };
  const option = (variant.option || "").toLowerCase();
  const value = (variant.title || "").trim();
  if (option === "color" || option === "colour") return { size: "", color: value };
  return { size: value, color: "" };
}

type StockRowInsert = {
  sku: string;
  name: string;
  category: string;
  size: string;
  color: string;
  cost: number;
  price: number;
  stock_in: number;
  low_stock_at: number;
  archived: boolean;
  note: string;
  product_id: string;
};

/**
 * Build the stock_items rows that back a product: one row per variant
 * (sku = variant id, so online orders deduct the exact row), or a single
 * row for products without variants. Each variant's `stock` seeds its own
 * row; the top-level `stockIn` is the fallback for the no-variant case
 * (and for older clients that only sent the single field).
 */
function buildStockRows(
  product: { id: string; handle: string },
  input: ProductInput,
  category: string,
  skus: string[],
): StockRowInsert[] {
  const cost = typeof input.cost === "number" && input.cost >= 0 ? input.cost : 0;
  const startingStock = Math.max(Math.round(input.stockIn ?? 0), 0);
  const base = {
    name: input.title.trim(),
    category,
    cost,
    low_stock_at: 0,
    archived: false,
    note: "Auto-linked from Products",
    product_id: product.id,
  };

  if (input.variants.length === 0) {
    return [
      {
        ...base,
        sku: skus[0] ?? `${product.handle}-default`,
        size: "Default",
        color: "",
        price: input.price,
        stock_in: startingStock,
      },
    ];
  }

  return input.variants.map((variant, index) => ({
    ...base,
    sku: skus[index] ?? `${product.handle}-v${index}`,
    ...variantToSizeColor(variant),
    price: Number(variant.price) || input.price,
    stock_in: Math.max(Math.round(variant.stock ?? (index === 0 ? startingStock : 0)), 0),
  }));
}

/** Insert the stock rows for a new product (best-effort — never fails the product create). */
async function createProductStockRows(
  supabase: SupabaseClient,
  product: { id: string; handle: string },
  input: ProductInput,
  category: string,
): Promise<void> {
  const rows = buildStockRows(product, input, category, []);
  const { data: inserted, error } = await supabase
    .from("stock_items")
    .insert(rows)
    .select("id, stock_in, cost");
  if (error) throw new Error(error.message);

  // Mirror createStockItem(): record initial stock as a movement.
  const movements = ((inserted ?? []) as Array<{ id: string; stock_in: number; cost: number }>)
    .filter((row) => row.stock_in > 0)
    .map((row) => ({
      stock_item_id: row.id,
      delta: row.stock_in,
      reason: "restock",
      unit_cost: row.cost,
      reference: "initial stock",
    }));
  if (movements.length > 0) {
    const { error: movementError } = await supabase.from("stock_movements").insert(movements);
    if (movementError) throw new Error(movementError.message);
  }
}

export const createAdminProduct = createServerFn({ method: "POST" })
  .inputValidator(tokenSchema.extend({ input: productInputSchema }))
  .handler(async ({ data }) => {
    await assertAdmin(data.accessToken);
    const supabase = createServiceClient();
    const input = data.input as ProductInput;
    const category = input.productType?.trim() || "Other";
    const handle = stockGroupHandle(input.title, category);
    const variantIds = input.variants.map((_, index) => `${handle}-v${index}`);

    const { data: product, error } = await supabase
      .from("products")
      .insert(productInputToDbRow({ ...input, handle }, true, variantIds))
      .select("*")
      .single();
    if (error || !product) throw new Error(error?.message || "Failed to create product");

    // Link the product to the POS: one stock row per variant, so restocking,
    // in-store sales and online-order deductions all work out of the box.
    // Best-effort: a stock-link failure must not lose the created product.
    try {
      await createProductStockRows(
        supabase,
        product as { id: string; handle: string },
        input,
        category,
      );
    } catch (stockError) {
      console.error("[createAdminProduct] Stock linking failed:", stockError);
    }

    return product;
  });

/** Reconcile a product's linked stock rows after an edit (see updateAdminProduct). */
async function reconcileProductStock(
  supabase: SupabaseClient,
  product: { id: string; handle: string },
  input: ProductInput,
  category: string,
  skus: string[],
): Promise<void> {
  const { data: linked, error } = await supabase
    .from("stock_items")
    .select("id, sku, size, color, product_id, archived")
    .eq("product_id", product.id);
  if (error) throw new Error(error.message);

  type LinkedRow = { id: string; sku: string; size: string; color: string; archived: boolean };
  const pool = ((linked ?? []) as LinkedRow[]).map((row) => ({
    ...row,
    size: row.size ?? "",
    color: row.color ?? "",
  }));
  const unclaimed = new Set(pool.map((row) => row.id));
  const desired = buildStockRows(product, input, category, skus);

  for (const row of desired) {
    // Match an existing row by exact sku first, then by size/colour.
    const candidate =
      pool.find((m) => unclaimed.has(m.id) && m.sku === row.sku) ??
      pool.find((m) => unclaimed.has(m.id) && m.size === row.size && m.color === row.color);

    if (candidate) {
      // Update in place: SKU and stock counts stay connected to past sales.
      unclaimed.delete(candidate.id);
      const { error: updateError } = await supabase
        .from("stock_items")
        .update({
          name: row.name,
          category: row.category,
          size: row.size,
          color: row.color,
          price: row.price,
          ...(typeof input.cost === "number" ? { cost: input.cost } : {}),
          archived: false,
          product_id: product.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", candidate.id);
      if (updateError) throw new Error(updateError.message);
    } else {
      const { data: insertedRow, error: insertError } = await supabase
        .from("stock_items")
        .insert(row)
        .select("id, stock_in, cost")
        .single();
      if (insertError) throw new Error(insertError.message);
      const inserted = insertedRow as { id: string; stock_in: number; cost: number };
      if (inserted.stock_in > 0) {
        await supabase.from("stock_movements").insert({
          stock_item_id: inserted.id,
          delta: inserted.stock_in,
          reason: "restock",
          unit_cost: inserted.cost,
          reference: "initial stock",
        });
      }
    }
  }

  // Anything still unclaimed is no longer part of this product: archive it
  // (never delete — past sales keep their cost snapshots).
  if (unclaimed.size > 0) {
    const { error: archiveError } = await supabase
      .from("stock_items")
      .update({ archived: true, updated_at: new Date().toISOString() })
      .in("id", Array.from(unclaimed));
    if (archiveError) throw new Error(archiveError.message);
  }
}

export const updateAdminProduct = createServerFn({ method: "POST" })
  .inputValidator(tokenSchema.extend({ id: z.string().uuid(), input: productInputSchema }))
  .handler(async ({ data }) => {
    await assertAdmin(data.accessToken);
    const supabase = createServiceClient();
    const input = data.input as ProductInput;
    const category = input.productType?.trim() || "Other";
    const newHandle = stockGroupHandle(input.title, category);

    const { data: existing, error: existingError } = await supabase
      .from("products")
      .select("id, handle, variants")
      .eq("id", data.id)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (!existing) throw new Error("Product not found");

    if (newHandle !== existing.handle) {
      const { data: clash } = await supabase
        .from("products")
        .select("id")
        .eq("handle", newHandle)
        .maybeSingle();
      if (clash && clash.id !== data.id) {
        throw new Error(
          `Another product already uses the URL "${newHandle}". Rename that one first, or change this product's title/type.`,
        );
      }
    }

    // Keep existing variant ids (they double as stock SKUs) so order history
    // and stock rows stay connected across edits. Match by option+value, not
    // position, so adding/removing a variant doesn't shuffle stock onto the
    // wrong size/colour.
    const oldVariants =
      (existing.variants as Array<{ id: string; title?: string; option?: string }> | null) ?? [];
    const variantIds = input.variants.map((variant, index) => {
      const match = oldVariants.find(
        (old) => old?.title === variant.title && old?.option === variant.option,
      );
      return match?.id ?? `${newHandle}-v${index}`;
    });

    const { data: product, error } = await supabase
      .from("products")
      .update(productInputToDbRow({ ...input, handle: newHandle }, true, variantIds))
      .eq("id", data.id)
      .select("*")
      .single();
    if (error || !product) throw new Error(error?.message || "Failed to update product");

    try {
      await reconcileProductStock(
        supabase,
        product as { id: string; handle: string },
        input,
        category,
        variantIds,
      );
    } catch (stockError) {
      console.error("[updateAdminProduct] Stock sync failed:", stockError);
    }

    return product;
  });

export const deleteAdminProduct = createServerFn({ method: "POST" })
  .inputValidator(tokenSchema.extend({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    await assertAdmin(data.accessToken);
    const supabase = createServiceClient();

    // Archive the linked stock rows first (keeps sale history intact); the
    // stock sync trigger then marks the product unavailable before it goes.
    const { error: archiveError } = await supabase
      .from("stock_items")
      .update({ archived: true, updated_at: new Date().toISOString() })
      .eq("product_id", data.id);
    if (archiveError) throw new Error(archiveError.message);

    const { error } = await supabase.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createAdminCollection = createServerFn({ method: "POST" })
  .inputValidator(tokenSchema.extend({ input: collectionInputSchema }))
  .handler(async ({ data }) => {
    await assertAdmin(data.accessToken);
    const input = data.input as CreateCollectionInput;
    const { data: collection, error } = await createServiceClient()
      .from("collections")
      .insert({
        title: input.title,
        handle: generateHandle(input.title),
        description: input.description || "",
      })
      .select("*")
      .single();
    if (error || !collection) throw new Error(error?.message || "Failed to create collection");
    return collection;
  });

export const updateAdminCollection = createServerFn({ method: "POST" })
  .inputValidator(
    tokenSchema.extend({
      id: z.string().uuid(),
      input: z.object({ title: z.string().min(1).optional(), description: z.string().optional() }),
    }),
  )
  .handler(async ({ data }) => {
    await assertAdmin(data.accessToken);
    const input = data.input as UpdateCollectionInput;
    const updates: Record<string, string> = {};
    if (input.title !== undefined) {
      updates.title = input.title;
      updates.handle = generateHandle(input.title);
    }
    if (input.description !== undefined) updates.description = input.description;

    const { data: collection, error } = await createServiceClient()
      .from("collections")
      .update(updates)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error || !collection) throw new Error(error?.message || "Failed to update collection");
    return collection;
  });

export const deleteAdminCollection = createServerFn({ method: "POST" })
  .inputValidator(tokenSchema.extend({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    await assertAdmin(data.accessToken);
    const supabase = createServiceClient();
    const { data: productsWithCollection } = await supabase
      .from("products")
      .select("id")
      .contains("collections", [data.id]);
    if (productsWithCollection && productsWithCollection.length > 0) {
      throw new Error(
        `Cannot delete collection: ${productsWithCollection.length} product(s) are using it`,
      );
    }

    const { error } = await supabase.from("collections").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateAdminProductCollections = createServerFn({ method: "POST" })
  .inputValidator(
    tokenSchema.extend({
      productId: z.string().uuid(),
      collectionIds: z.array(z.string()),
    }),
  )
  .handler(async ({ data }) => {
    await assertAdmin(data.accessToken);
    const { error } = await createServiceClient()
      .from("products")
      .update({ collections: data.collectionIds })
      .eq("id", data.productId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateAdminOrderStatus = createServerFn({ method: "POST" })
  .inputValidator(
    tokenSchema.extend({
      id: z.string().uuid(),
      status: z.enum(["pending", "paid", "shipped", "done", "cancelled"]),
    }),
  )
  .handler(async ({ data }) => {
    await assertAdmin(data.accessToken);
    const supabase = createServiceClient();
    const { error } = await supabase
      .from("orders")
      .update({ status: data.status satisfies OrderStatus })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    // Keep the POS in sync with the website order: record the sale and
    // deduct stock when money is collected, cancel/refund/restock when
    // the order is cancelled, and keep the delivery status current.
    try {
      await syncOrderWithPos(supabase, data.id, data.status);
    } catch (syncError) {
      throw new Error(
        `Status saved, but POS sync failed: ${
          syncError instanceof Error ? syncError.message : String(syncError)
        }`,
      );
    }

    return { ok: true };
  });

type OrderStatusDb = "pending" | "paid" | "shipped" | "done" | "cancelled";

interface OrderItemJson {
  productId?: string;
  variantId?: string | null;
  title?: string;
  quantity?: number;
  price?: number;
}

interface OrderRow {
  id: string;
  customer_name: string;
  phone: string;
  address: string;
  total: number;
  items: OrderItemJson[] | null;
}

/**
 * Mirror an online order's lifecycle into the POS:
 *  - paid / done  → record a POS sale (channel 'online', paid in cash on
 *    delivery) via record_online_sale, which also deducts stock and posts
 *    the cash to the ledger. Idempotent per order.
 *  - shipped      → mark the linked sale as sent.
 *  - done         → mark the linked sale as delivered.
 *  - cancelled    → cancel the linked sale (restocks items, posts a refund).
 */
async function syncOrderWithPos(
  serviceSupabase: SupabaseClient,
  orderId: string,
  status: OrderStatusDb,
): Promise<void> {
  const { data: existingSale, error: saleError } = await serviceSupabase
    .from("sales")
    .select("id, status")
    .eq("order_id", orderId)
    .maybeSingle();
  if (saleError) throw new Error(saleError.message);

  if (status === "cancelled") {
    if (existingSale && existingSale.status !== "cancelled") {
      const { error } = await serviceSupabase.rpc("cancel_sale", {
        target_sale: existingSale.id,
      });
      if (error) throw new Error(error.message);
    }
    return;
  }

  if (status === "shipped" && existingSale) {
    const { error } = await serviceSupabase
      .from("sales")
      .update({ delivery_status: "sent" })
      .eq("id", existingSale.id);
    if (error) throw new Error(error.message);
    return;
  }

  if (status === "done" && existingSale) {
    const { error } = await serviceSupabase
      .from("sales")
      .update({ delivery_status: "delivered" })
      .eq("id", existingSale.id);
    if (error) throw new Error(error.message);
    return;
  }

  // Only paid / done create a sale (pending and shipped do not).
  if ((status !== "paid" && status !== "done") || existingSale) return;

  const { data: order, error: orderError } = await serviceSupabase
    .from("orders")
    .select("id, customer_name, phone, address, total, items")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError) throw new Error(orderError.message);
  if (!order) throw new Error("Order not found");
  const orderRow = order as OrderRow;

  const lines = await buildSaleLines(serviceSupabase, orderRow.items ?? []);

  const { error } = await serviceSupabase.rpc("record_online_sale", {
    payload: {
      orderId,
      soldAt: new Date().toISOString().slice(0, 10),
      customerName: orderRow.customer_name || "Online customer",
      phone: orderRow.phone ?? "",
      address: orderRow.address ?? "",
      city: "",
      channel: "online",
      deliveryMethod: "Delivery",
      deliveryFee: 0,
      deliveryStatus: status === "done" ? "delivered" : "preparing",
      discount: 0,
      paid: Number(orderRow.total) || 0,
      paymentMethod: "cash",
      note: `Online order ${orderId.slice(0, 8)}`,
      items: lines,
    },
  });
  if (error) throw new Error(error.message);
}

/**
 * Map the order's stored items (productId / variantId / price) onto POS
 * stock items. Stock-linked products have stock_items.sku === variantId;
 * otherwise we fall back to stock_items.product_id. Lines with no match
 * are still recorded (stockItemId null), they just don't move stock.
 */
async function buildSaleLines(
  serviceSupabase: SupabaseClient,
  items: OrderItemJson[],
): Promise<
  Array<{
    stockItemId: string | null;
    name: string;
    size: string;
    color: string;
    qty: number;
    unitPrice: number;
    unitCost: number;
  }>
> {
  const variantIds = [...new Set(items.map((i) => i.variantId).filter(Boolean))] as string[];
  const productIds = [...new Set(items.map((i) => i.productId).filter(Boolean))] as string[];

  const filters: string[] = [];
  if (variantIds.length) filters.push(`sku.in.(${variantIds.join(",")})`);
  if (productIds.length) filters.push(`product_id.in.(${productIds.join(",")})`);

  type StockRow = {
    id: string;
    sku: string;
    product_id: string | null;
    name: string;
    size: string;
    color: string;
    cost: number;
    archived: boolean;
  };
  let stockRows: StockRow[] = [];
  if (filters.length) {
    const { data, error } = await serviceSupabase
      .from("stock_items")
      .select("id, sku, product_id, name, size, color, cost, archived")
      .or(filters.join(","));
    if (error) throw new Error(error.message);
    stockRows = (data ?? []) as StockRow[];
  }

  const bySku = new Map(stockRows.map((row) => [row.sku, row]));
  const byProduct = new Map<string, StockRow[]>();
  for (const row of stockRows) {
    if (!row.product_id) continue;
    const list = byProduct.get(row.product_id) ?? [];
    list.push(row);
    byProduct.set(row.product_id, list);
  }

  return items.map((item) => {
    const qty = Math.max(Math.round(Number(item.quantity) || 1), 1);
    const unitPrice = Number(item.price) || 0;
    const stock =
      (item.variantId ? bySku.get(item.variantId) : undefined) ??
      (item.productId
        ? (byProduct.get(item.productId) ?? []).find((row) => !row.archived)
        : undefined);

    return {
      stockItemId: stock?.id ?? null,
      name: stock?.name ?? item.title ?? "Item",
      size: stock?.size ?? "",
      color: stock?.color ?? "",
      qty,
      unitPrice,
      unitCost: stock ? Number(stock.cost) : 0,
    };
  });
}

export const updateAdminFeedbackApproval = createServerFn({ method: "POST" })
  .inputValidator(tokenSchema.extend({ id: z.string().uuid(), approved: z.boolean() }))
  .handler(async ({ data }) => {
    await assertAdmin(data.accessToken);
    const { error } = await createServiceClient()
      .from("feedback")
      .update({ approved: data.approved })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAdminFeedback = createServerFn({ method: "POST" })
  .inputValidator(tokenSchema.extend({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    await assertAdmin(data.accessToken);
    const { error } = await createServiceClient().from("feedback").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function sha256(value: string): Promise<Buffer> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(value).digest();
}

async function hmacSha256(data: string, secret: Buffer): Promise<string> {
  const { createHmac } = await import("node:crypto");
  return createHmac("sha256", secret).update(data).digest("hex");
}

async function safeEqualHex(a: string, b: string): Promise<boolean> {
  const { timingSafeEqual } = await import("node:crypto");
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

function getTelegramPairs(data: z.infer<typeof telegramUserSchema>): Record<string, string> {
  return {
    id: String(data.id),
    first_name: data.first_name,
    ...(data.last_name ? { last_name: data.last_name } : {}),
    ...(data.username ? { username: data.username } : {}),
    ...(data.photo_url ? { photo_url: data.photo_url } : {}),
    auth_date: String(data.auth_date),
  };
}

function getTelegramDataCheckString(pairs: Record<string, string>): string {
  return Object.entries(pairs)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

async function verifyTelegramHash(data: z.infer<typeof telegramUserSchema>): Promise<boolean> {
  const token = getEnv("TELEGRAM_BOT_TOKEN");
  if (!token) throw new Error("Missing TELEGRAM_BOT_TOKEN");
  const ageSeconds = Math.floor(Date.now() / 1000) - data.auth_date;
  if (ageSeconds < 0 || ageSeconds > 3600) return false;

  const secret = await sha256(token);
  const expected = await hmacSha256(getTelegramDataCheckString(getTelegramPairs(data)), secret);
  return safeEqualHex(expected, data.hash);
}

function telegramEmail(data: z.infer<typeof telegramUserSchema>): string {
  return data.username ? `${data.username}@telegram.local` : `tg_${data.id}@telegram.local`;
}

async function telegramPassword(telegramId: number): Promise<string> {
  const token = getEnv("TELEGRAM_AUTH_SECRET") || getEnv("TELEGRAM_BOT_TOKEN");
  if (!token) throw new Error("Missing TELEGRAM_AUTH_SECRET or TELEGRAM_BOT_TOKEN");
  const secret = await sha256(token);
  return hmacSha256(`telegram:${telegramId}`, secret);
}

function authUserToUser(
  authUser: {
    id: string;
    email?: string;
    created_at?: string;
    user_metadata?: Record<string, unknown>;
  },
  name: string,
  role: UserRole = "user",
): User {
  return {
    id: authUser.id,
    email: authUser.email || "",
    name,
    role,
    createdAt: authUser.created_at ? new Date(authUser.created_at).getTime() : Date.now(),
  };
}

export const verifyTelegramLogin = createServerFn({ method: "POST" })
  .inputValidator(telegramUserSchema)
  .handler(async ({ data }): Promise<TelegramLoginResult> => {
    const isValid = await verifyTelegramHash(data);
    if (!isValid) return { success: false, error: "Invalid Telegram authentication data" };

    const serviceSupabase = createServiceClient();
    const userSupabase = createUserClient();
    const email = telegramEmail(data);
    const password = await telegramPassword(data.id);
    const name = [data.first_name, data.last_name].filter(Boolean).join(" ");

    let { data: signInData, error: signInError } = await userSupabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData.user || !signInData.session) {
      const { error: createError } = await serviceSupabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name,
          telegram_id: data.id,
          telegram_username: data.username,
          telegram_photo: data.photo_url,
        },
      });

      if (createError && !createError.message.toLowerCase().includes("already")) {
        return { success: false, error: createError.message };
      }

      if (createError) {
        const { data: listed } = await serviceSupabase.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        const existing = listed.users.find((user) => user.email === email);
        if (existing) {
          await serviceSupabase.auth.admin.updateUserById(existing.id, {
            password,
            user_metadata: {
              ...(existing.user_metadata ?? {}),
              name,
              telegram_id: data.id,
              telegram_username: data.username,
              telegram_photo: data.photo_url,
            },
          });
        }
      }

      const retry = await userSupabase.auth.signInWithPassword({ email, password });
      signInData = retry.data;
      signInError = retry.error;
    }

    if (signInError || !signInData.user || !signInData.session) {
      return { success: false, error: signInError?.message || "Telegram login failed" };
    }

    const { data: profile } = await serviceSupabase
      .from("profiles")
      .select("name, role")
      .eq("id", signInData.user.id)
      .maybeSingle();

    return {
      success: true,
      user: authUserToUser(
        signInData.user,
        (profile?.name as string | null) || name,
        ((profile?.role as UserRole | null) || "user") as UserRole,
      ),
      session: {
        accessToken: signInData.session.access_token,
        refreshToken: signInData.session.refresh_token,
      },
    };
  });
