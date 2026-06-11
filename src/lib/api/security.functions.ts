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
});

const productInputSchema = z.object({
  handle: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  productType: z.string(),
  price: z.number().nonnegative(),
  currency: z.string().min(1),
  imageUrl: z.string(),
  inStock: z.boolean(),
  collections: z.array(z.string()),
  variants: z.array(productVariantSchema),
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

  if (profileError || profile?.role !== "admin") {
    throw new Error("Admin access required");
  }

  return user.id;
}

function productInputToDbRow(input: ProductInput, includeVariants = true): Record<string, unknown> {
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

export const createAdminProduct = createServerFn({ method: "POST" })
  .inputValidator(tokenSchema.extend({ input: productInputSchema }))
  .handler(async ({ data }) => {
    await assertAdmin(data.accessToken);
    const { data: product, error } = await createServiceClient()
      .from("products")
      .insert(productInputToDbRow(data.input as ProductInput))
      .select("*")
      .single();
    if (error || !product) throw new Error(error?.message || "Failed to create product");
    return product;
  });

export const updateAdminProduct = createServerFn({ method: "POST" })
  .inputValidator(tokenSchema.extend({ id: z.string().uuid(), input: productInputSchema }))
  .handler(async ({ data }) => {
    await assertAdmin(data.accessToken);
    const { data: product, error } = await createServiceClient()
      .from("products")
      .update(productInputToDbRow(data.input as ProductInput))
      .eq("id", data.id)
      .select("*")
      .single();
    if (error || !product) throw new Error(error?.message || "Failed to update product");
    return product;
  });

export const deleteAdminProduct = createServerFn({ method: "POST" })
  .inputValidator(tokenSchema.extend({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    await assertAdmin(data.accessToken);
    const { error } = await createServiceClient().from("products").delete().eq("id", data.id);
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
    const { error } = await createServiceClient()
      .from("orders")
      .update({ status: data.status satisfies OrderStatus })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
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
  authUser: { id: string; email?: string; created_at?: string; user_metadata?: Record<string, unknown> },
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
