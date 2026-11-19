import { randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { shopToday } from "@/lib/server/supabaseAdmin";
import { writeWithActor } from "@/lib/server/audit";
import { isPayWayConfigured } from "@/lib/server/payway";
import {
  ORDER_COLUMNS,
  announceNewOrder,
  applyOrderStatus,
  assertStockAvailable,
  getOrder,
  syncOrderWithPos,
  type OrderRecord,
} from "@/lib/server/orderLifecycle";

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
  // Size + colour combination — either side can be empty.
  size: z.string().optional(),
  color: z.string().optional(),
  // Legacy single-option fields (older saved forms) — still accepted.
  title: z.string().optional(),
  option: z.string().optional(),
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
  paymentMethod: z.enum(["khqr", "aba_manual", "cod"]).default("cod"),
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

const telegramIdentitySchema = telegramUserSchema.omit({ hash: true });

const telegramWebAppSchema = z.object({
  initData: z.string().min(1),
});

type TelegramIdentity = z.infer<typeof telegramIdentitySchema>;

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

export async function assertAdmin(accessToken?: string | null): Promise<string> {
  console.log("[assertAdmin] Starting check, token exists:", !!accessToken);
  if (!accessToken) throw new Error("Authentication required");
  const supabase = createUserClient(accessToken);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(accessToken);
  console.log("[assertAdmin] User check:", { userId: user?.id, error: userError?.message });
  if (userError || !user) throw new Error("Authentication required");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  console.log("[assertAdmin] Profile check:", { profile, error: profileError?.message });
  
  // Surface the real reason (e.g. RLS misconfig / recursion) instead of
  // masking it as a generic "not an admin" message.
  if (profileError) {
    console.error("[assertAdmin] Could not read profile:", profileError);
    throw new Error(`Admin check failed: ${profileError.message}`);
  }
  if (profile?.role !== "admin") {
    console.error("[assertAdmin] Not admin, role is:", profile?.role);
    throw new Error("Admin access required");
  }

  console.log("[assertAdmin] Admin verified:", user.id);
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
      const { stock: _stock, ...rest } = variant;
      // Accept both the new size+colour shape and the legacy title/option shape.
      const { size, color } = variantToSizeColor(rest);
      const selectedOptions = [
        ...(size && size !== "Default" ? [{ name: "Size", value: size }] : []),
        ...(color ? [{ name: "Color", value: color }] : []),
      ];
      return {
        id: variantIds?.[index] ?? `${input.handle}-v${index}`,
        title: [size === "Default" ? "" : size, color].filter(Boolean).join(" / ") || "Default",
        option: color ? (size && size !== "Default" ? "Size" : "Color") : "Size",
        price: rest.price,
        availableForSale: rest.availableForSale,
        ...(selectedOptions.length > 0 ? { selectedOptions } : {}),
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

/** Unique, easy-to-read order reference, e.g. BG-261117-7KQ3. */
function generateOrderReference(): string {
  const date = shopToday().slice(2).replace(/-/g, "");
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0/O/1/I
  const bytes = randomBytes(4);
  const code = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `BG-${date}-${code}`;
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

    if (data.paymentMethod === "khqr" && !isPayWayConfigured()) {
      throw new Error("KHQR payment is not available right now. Please choose another method.");
    }
    await assertStockAvailable(serviceSupabase, orderItems);

    let order: OrderRecord | null = null;
    let lastError: string | null = null;
    // Retry on the (very unlikely) chance the random reference already exists.
    for (let attempt = 0; attempt < 3 && !order; attempt++) {
      const { data: inserted, error: orderError } = await serviceSupabase
        .from("orders")
        .insert({
          user_id: userId,
          customer_name: data.customerName,
          phone: data.phone,
          address: data.address,
          total: Math.round(total * 100) / 100,
          currency: currency ?? "USD",
          bakong_reference: generateOrderReference(),
          bakong_transaction_id: null,
          payment_method: data.paymentMethod,
          status: "pending",
          items: orderItems,
        })
        .select(ORDER_COLUMNS)
        .single();
      if (inserted) order = inserted as unknown as OrderRecord;
      else if (orderError?.code !== "23505") {
        lastError = orderError?.message ?? "Failed to create order";
        break;
      }
    }

    if (!order) throw new Error(lastError || "Failed to create order");

    // Re-check now that this order is saved: if another customer checked out
    // the same last item at the same moment, one of the two orders is removed.
    try {
      await assertStockAvailable(serviceSupabase, orderItems, { excludeOrderId: order.id });
    } catch (stockError) {
      await serviceSupabase.from("orders").delete().eq("id", order.id);
      throw stockError;
    }

    await announceNewOrder(serviceSupabase, order).catch((error) =>
      console.error("[createSecureOrder] alert failed:", error),
    );

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
function variantToSizeColor(variant?: {
  size?: string;
  color?: string;
  title?: string;
  option?: string;
}): {
  size: string;
  color: string;
} {
  if (!variant) return { size: "Default", color: "" };
  const size = (variant.size ?? "").trim();
  const color = (variant.color ?? "").trim();
  if (size || color) return { size: size || "Default", color };
  // Legacy single-option shape ("option" = "Size" or "Color", value in "title").
  const option = (variant.option || "").toLowerCase();
  const value = (variant.title || "").trim();
  if (option.startsWith("color")) return { size: "", color: value };
  return { size: value || "Default", color: "" };
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
    low_stock_at: 3,
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
    const adminId = await assertAdmin(data.accessToken);
    const supabase = createServiceClient();
    const input = data.input as ProductInput;
    const category = input.productType?.trim() || "Other";
    const handle = stockGroupHandle(input.title, category);
    const variantIds = input.variants.map((_, index) => `${handle}-v${index}`);

    const { data: product, error } = await writeWithActor(
      (row) => supabase.from("products").insert(row).select("*").single(),
      productInputToDbRow({ ...input, handle }, true, variantIds),
      adminId,
    );
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
    const adminId = await assertAdmin(data.accessToken);
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
    // and stock rows stay connected across edits. Match by size+colour, not
    // position, so adding/removing a variant doesn't shuffle stock onto the
    // wrong size/colour. Handles both the stored size+colour shape and the
    // legacy title/option shape.
    const oldVariants =
      (existing.variants as Array<{
        id: string;
        title?: string;
        option?: string;
        selectedOptions?: Array<{ name: string; value: string }> | null;
      }> | null) ?? [];
    const oldVariantKey = (old: (typeof oldVariants)[number]): string => {
      const size = old?.selectedOptions?.find((o) => o.name === "Size")?.value ?? "";
      const color = old?.selectedOptions?.find((o) => o.name === "Color")?.value ?? "";
      if (size || color) return `${size.trim()}|${color.trim()}`;
      const mapped = variantToSizeColor(old);
      return `${mapped.size.trim()}|${mapped.color.trim()}`;
    };
    const variantIds = input.variants.map((variant, index) => {
      const wanted = `${variant.size.trim()}|${variant.color.trim()}`;
      const match = oldVariants.find((old) => oldVariantKey(old) === wanted);
      return match?.id ?? `${newHandle}-v${index}`;
    });

    const { data: product, error } = await writeWithActor(
      (row) => supabase.from("products").update(row).eq("id", data.id).select("*").single(),
      productInputToDbRow({ ...input, handle: newHandle }, true, variantIds),
      adminId,
    );
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
    console.log("[deleteAdminProduct] Starting delete for product:", data.id);
    
    const adminId = await assertAdmin(data.accessToken);
    console.log("[deleteAdminProduct] Admin verified:", adminId);
    
    const supabase = createServiceClient();
    console.log("[deleteAdminProduct] Service client created");

    // Archive the linked stock rows first (keeps sale history intact); the
    // stock sync trigger then marks the product unavailable before it goes.
    console.log("[deleteAdminProduct] Archiving stock items...");
    const { error: archiveError } = await supabase
      .from("stock_items")
      .update({ archived: true, updated_at: new Date().toISOString() })
      .eq("product_id", data.id);
    if (archiveError) {
      console.error("[deleteAdminProduct] Archive error:", archiveError);
      throw new Error(archiveError.message);
    }

    console.log("[deleteAdminProduct] Deleting product...");
    const { error } = await supabase.from("products").delete().eq("id", data.id);
    if (error) {
      console.error("[deleteAdminProduct] Delete error:", error);
      throw new Error(error.message);
    }
    
    console.log("[deleteAdminProduct] Delete successful");
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
    const adminId = await assertAdmin(data.accessToken);
    // Saves the status, keeps the POS / stock in sync and notifies the customer.
    await applyOrderStatus(
      createServiceClient(),
      data.id,
      data.status satisfies OrderStatus,
      adminId,
    );
    return { ok: true };
  });

/**
 * Run the POS sync again for an order whose status was saved but whose sale
 * failed (e.g. not enough stock at the time). Safe to repeat: record_online_sale
 * is idempotent per order and cancel_sale ignores already-cancelled sales.
 */
export const retryAdminOrderPosSync = createServerFn({ method: "POST" })
  .inputValidator(tokenSchema.extend({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    await assertAdmin(data.accessToken);
    const supabase = createServiceClient();
    const order = await getOrder(supabase, data.id);
    // A prepaid order that went straight to "shipped" never had its sale
    // created (only paid / done create one), so record it first.
    if (order.status === "shipped" && order.payment_method !== "cod") {
      await syncOrderWithPos(supabase, order.id, "paid");
    }
    await syncOrderWithPos(supabase, order.id, order.status);
    return { ok: true };
  });

/**
 * Public order tracking: needs the order reference AND the phone number used
 * at checkout, so nobody can look up other people's orders.
 */
export const trackOrder = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      reference: z.string().trim().min(4).max(60),
      phone: z.string().trim().min(6).max(40),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = createServiceClient();
    const reference = data.reference.toUpperCase();
    const { data: row, error } = await supabase
      .from("orders")
      .select(ORDER_COLUMNS)
      .eq("bakong_reference", reference)
      .maybeSingle();
    if (error) throw new Error("Could not look up the order");
    const order = row as unknown as OrderRecord | null;
    const digits = (value: string) => value.replace(/\D/g, "").replace(/^855/, "").replace(/^0/, "");
    if (!order || digits(order.phone) !== digits(data.phone)) return null;
    return {
      id: order.id,
      reference: order.bakong_reference,
      status: order.status,
      paymentMethod: order.payment_method,
      total: Number(order.total),
      currency: order.currency,
      createdAt: order.created_at,
      paidAt: order.paid_at,
      customerName: order.customer_name,
      items: (order.items ?? []).map((item) => ({
        title: item.title ?? "Item",
        quantity: Number(item.quantity ?? 1),
      })),
    };
  });

/**
 * Cancel KHQR orders nobody paid for (QR expired more than an hour ago).
 * Each one is checked with ABA first, so a late payment is never lost.
 */
export const cancelUnpaidKhqrOrders = createServerFn({ method: "POST" })
  .inputValidator(tokenSchema)
  .handler(async ({ data }) => {
    await assertAdmin(data.accessToken);
    const { cancelExpiredKhqrOrders } = await import("@/lib/server/payments");
    return cancelExpiredKhqrOrders(createServiceClient());
  });

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

function getTelegramLoginToken(): string | undefined {
  return getEnv("TELEGRAM_LOGIN_BOT_TOKEN") || getEnv("TELEGRAM_BOT_TOKEN");
}

async function verifyTelegramHash(data: z.infer<typeof telegramUserSchema>): Promise<boolean> {
  const token = getTelegramLoginToken();
  if (!token) throw new Error("Missing TELEGRAM_LOGIN_BOT_TOKEN or TELEGRAM_BOT_TOKEN");
  const ageSeconds = Math.floor(Date.now() / 1000) - data.auth_date;
  if (ageSeconds < 0 || ageSeconds > 3600) return false;

  const secret = await sha256(token);
  const expected = await hmacSha256(getTelegramDataCheckString(getTelegramPairs(data)), secret);
  return safeEqualHex(expected, data.hash);
}

async function verifyTelegramWebAppData(initData: string): Promise<TelegramIdentity> {
  const token = getTelegramLoginToken();
  if (!token) throw new Error("Missing TELEGRAM_LOGIN_BOT_TOKEN or TELEGRAM_BOT_TOKEN");

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDate = Number(params.get("auth_date"));
  const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
  if (!hash || !Number.isFinite(authDate) || ageSeconds < 0 || ageSeconds > 3600) {
    throw new Error("Invalid Telegram WebApp data");
  }

  const pairs: Record<string, string> = {};
  params.forEach((value, key) => {
    if (key !== "hash") pairs[key] = value;
  });

  const { createHmac } = await import("node:crypto");
  const secretKey = createHmac("sha256", "WebAppData").update(token).digest();
  const expected = createHmac("sha256", secretKey)
    .update(getTelegramDataCheckString(pairs))
    .digest("hex");
  if (!(await safeEqualHex(expected, hash))) throw new Error("Invalid Telegram WebApp data");

  const rawUser = params.get("user");
  if (!rawUser) throw new Error("Invalid Telegram WebApp data");
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawUser);
  } catch {
    throw new Error("Invalid Telegram WebApp data");
  }
  const user = telegramIdentitySchema.omit({ auth_date: true }).safeParse(parsed);
  if (!user.success) throw new Error("Invalid Telegram WebApp data");

  return { ...user.data, auth_date: authDate };
}

function telegramEmail(data: TelegramIdentity): string {
  return data.username ? `${data.username}@telegram.local` : `tg_${data.id}@telegram.local`;
}

async function telegramPassword(telegramId: number): Promise<string> {
  const token = getEnv("TELEGRAM_AUTH_SECRET") || getTelegramLoginToken();
  if (!token) throw new Error("Missing TELEGRAM_LOGIN_BOT_TOKEN or TELEGRAM_BOT_TOKEN");
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

async function signInTelegramUser(data: TelegramIdentity): Promise<TelegramLoginResult> {
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
}

export const verifyTelegramLogin = createServerFn({ method: "POST" })
  .inputValidator(telegramUserSchema)
  .handler(async ({ data }): Promise<TelegramLoginResult> => {
    if (!(await verifyTelegramHash(data))) {
      return { success: false, error: "Invalid Telegram authentication data" };
    }
    return signInTelegramUser(data);
  });

export const verifyTelegramWebApp = createServerFn({ method: "POST" })
  .inputValidator(telegramWebAppSchema)
  .handler(async ({ data }): Promise<TelegramLoginResult> => {
    let identity: TelegramIdentity;
    try {
      identity = await verifyTelegramWebAppData(data.initData);
    } catch {
      return { success: false, error: "Invalid Telegram authentication data" };
    }
    return signInTelegramUser(identity);
  });
