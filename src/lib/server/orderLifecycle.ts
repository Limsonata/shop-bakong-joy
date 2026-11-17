// Server-only: order status changes, POS/stock sync and the alerts that go with them.
// Shared by the admin orders page, Telegram buttons and automatic KHQR confirmation.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getEnv, shopToday } from "./supabaseAdmin";
import { writeWithActor } from "./audit";
import { notifyAdmins, notifyCustomer } from "./notify";
import { escapeHtml, type TelegramButton } from "./telegram";

export type OrderStatusDb = "pending" | "paid" | "shipped" | "done" | "cancelled";
export type PaymentMethodDb = "khqr" | "aba_manual" | "cod";

export interface OrderItemJson {
  productId?: string;
  variantId?: string | null;
  title?: string;
  quantity?: number;
  price?: number;
  currency?: string;
}

export interface OrderRecord {
  id: string;
  user_id: string | null;
  customer_name: string;
  phone: string;
  address: string;
  total: number;
  currency: string;
  bakong_reference: string | null;
  bakong_transaction_id: string | null;
  status: OrderStatusDb;
  payment_method: PaymentMethodDb;
  paid_at: string | null;
  payment_expires_at: string | null;
  items: OrderItemJson[] | null;
  created_at: string;
}

export const ORDER_COLUMNS =
  "id,user_id,customer_name,phone,address,total,currency,bakong_reference,bakong_transaction_id,status,payment_method,paid_at,payment_expires_at,items,created_at";

export const PAYMENT_METHOD_LABEL: Record<PaymentMethodDb, string> = {
  khqr: "KHQR (auto-confirmed)",
  aba_manual: "ABA QR (check manually)",
  cod: "Cash on delivery",
};

export function money(amount: number, currency = "USD"): string {
  const value = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  return currency.toUpperCase() === "USD" ? `$${value.toFixed(2)}` : `${value.toFixed(0)} ${currency}`;
}

export function orderRef(order: Pick<OrderRecord, "id" | "bakong_reference">): string {
  return order.bakong_reference || order.id.slice(0, 8).toUpperCase();
}

function appUrl(): string | null {
  const url = getEnv("APP_URL") || getEnv("VITE_APP_URL");
  return url ? url.replace(/\/$/, "") : null;
}

export async function getOrder(supabase: SupabaseClient, orderId: string): Promise<OrderRecord> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Order not found");
  return data as unknown as OrderRecord;
}

// ── Telegram message pieces ──────────────────────────────────

export function orderSummaryHtml(order: OrderRecord): string {
  const items = (order.items ?? [])
    .map(
      (item) =>
        `• ${escapeHtml(item.title ?? "Item")} × ${item.quantity ?? 1} — ${money(
          Number(item.price ?? 0) * Number(item.quantity ?? 1),
          order.currency,
        )}`,
    )
    .join("\n");
  const base = appUrl();
  return [
    `<b>Order:</b> ${escapeHtml(orderRef(order))}`,
    `<b>Total:</b> ${money(order.total, order.currency)} · ${escapeHtml(PAYMENT_METHOD_LABEL[order.payment_method] ?? order.payment_method)}`,
    "",
    items,
    "",
    `<b>Customer:</b> ${escapeHtml(order.customer_name)}`,
    `<b>Phone:</b> ${escapeHtml(order.phone)}`,
    `<b>Address:</b> ${escapeHtml(order.address)}`,
    base ? `\n<a href="${escapeHtml(`${base}/admin/orders`)}">Open orders</a>` : "",
  ]
    .filter((line) => line !== null)
    .join("\n")
    .trim();
}

/** Inline Telegram buttons for the next steps of an order. */
export function orderButtons(order: Pick<OrderRecord, "id" | "status" | "payment_method">): TelegramButton[][] {
  const id = order.id;
  switch (order.status) {
    case "pending":
      if (order.payment_method === "khqr") return [];
      // Cash orders go out first and are paid at the door.
      return order.payment_method === "cod"
        ? [[{ text: "🚚 Mark shipped", callbackData: `st:shipped:${id}` }]]
        : [[{ text: "💵 Payment checked — mark paid", callbackData: `st:paid:${id}` }]];
    case "paid":
      return [[{ text: "🚚 Mark shipped", callbackData: `st:shipped:${id}` }]];
    case "shipped":
      return [
        [
          {
            text: order.payment_method === "cod" ? "✅ Delivered & cash collected" : "✅ Mark delivered",
            callbackData: `st:done:${id}`,
          },
        ],
      ];
    default:
      return [];
  }
}

// ── POS / stock sync ─────────────────────────────────────────

type SaleLine = {
  stockItemId: string | null;
  name: string;
  size: string;
  color: string;
  qty: number;
  unitPrice: number;
  unitCost: number;
};

type StockRow = {
  id: string;
  sku: string;
  product_id: string | null;
  name: string;
  size: string;
  color: string;
  cost: number;
  archived: boolean;
  stock_in: number;
  sold: number;
  low_stock_at: number;
};

async function loadStockRows(supabase: SupabaseClient, items: OrderItemJson[]): Promise<StockRow[]> {
  const variantIds = [...new Set(items.map((i) => i.variantId).filter(Boolean))] as string[];
  const productIds = [...new Set(items.map((i) => i.productId).filter(Boolean))] as string[];
  const filters: string[] = [];
  // Quote values so ids with commas/dots can't break the PostgREST filter.
  const list = (values: string[]) => values.map((v) => `"${v.replace(/"/g, "")}"`).join(",");
  if (variantIds.length) filters.push(`sku.in.(${list(variantIds)})`);
  if (productIds.length) filters.push(`product_id.in.(${list(productIds)})`);
  if (!filters.length) return [];
  const { data, error } = await supabase
    .from("stock_items")
    .select("id, sku, product_id, name, size, color, cost, archived, stock_in, sold, low_stock_at")
    .or(filters.join(","));
  if (error) throw new Error(error.message);
  return (data ?? []) as StockRow[];
}

function matchStock(item: OrderItemJson, rows: StockRow[]): StockRow | undefined {
  return (
    (item.variantId ? rows.find((row) => row.sku === item.variantId) : undefined) ??
    (item.productId
      ? rows.find((row) => row.product_id === item.productId && !row.archived)
      : undefined)
  );
}

/**
 * Map order items onto POS stock items. Stock-linked products have
 * stock_items.sku === variantId; otherwise fall back to stock_items.product_id.
 * Lines with no match are still recorded (stockItemId null), they just don't move stock.
 */
export async function buildSaleLines(
  supabase: SupabaseClient,
  items: OrderItemJson[],
): Promise<SaleLine[]> {
  const rows = await loadStockRows(supabase, items);
  return items.map((item) => {
    const stock = matchStock(item, rows);
    return {
      stockItemId: stock?.id ?? null,
      name: stock?.name ?? item.title ?? "Item",
      size: stock?.size ?? "",
      color: stock?.color ?? "",
      qty: Math.max(Math.round(Number(item.quantity) || 1), 1),
      unitPrice: Number(item.price) || 0,
      unitCost: stock ? Number(stock.cost) : 0,
    };
  });
}

/** Orders older than this no longer hold stock (stale, never finished). */
const HOLD_MAX_AGE_DAYS = 30;

/**
 * Units promised to open online orders that have not taken stock yet.
 * Stock only leaves the shelf when a POS sale is recorded (paid, or delivered
 * for cash orders), so until then the order "holds" its items:
 *  - pending cash / ABA-QR orders, and shipped cash orders
 *  - pending KHQR orders whose QR is still open
 */
async function heldByOpenOrders(
  supabase: SupabaseClient,
  rows: StockRow[],
  excludeOrderId?: string,
): Promise<Map<string, number>> {
  const held = new Map<string, number>();
  if (!rows.length) return held;
  const since = new Date(Date.now() - HOLD_MAX_AGE_DAYS * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("orders")
    .select("id,status,payment_method,payment_expires_at,items")
    .in("status", ["pending", "shipped"])
    .gte("created_at", since)
    .limit(1000);
  if (error) throw new Error(error.message);

  const now = Date.now();
  const open = ((data ?? []) as Array<{
    id: string;
    status: OrderStatusDb;
    payment_method: PaymentMethodDb;
    payment_expires_at: string | null;
    items: OrderItemJson[] | null;
  }>).filter((order) => {
    if (order.id === excludeOrderId) return false;
    if (order.status === "pending" && order.payment_method === "khqr" && order.payment_expires_at) {
      return new Date(order.payment_expires_at).getTime() > now;
    }
    return true;
  });
  if (!open.length) return held;

  // Orders that already have a POS sale took their stock already.
  const { data: sales, error: salesError } = await supabase
    .from("sales")
    .select("order_id")
    .in("order_id", open.map((o) => o.id))
    .neq("status", "cancelled");
  if (salesError) throw new Error(salesError.message);
  const withSale = new Set((sales ?? []).map((s) => s.order_id as string));

  for (const order of open) {
    if (withSale.has(order.id)) continue;
    for (const item of order.items ?? []) {
      const row = matchStock(item, rows);
      if (!row) continue;
      held.set(row.id, (held.get(row.id) ?? 0) + Math.max(Number(item.quantity) || 1, 1));
    }
  }
  return held;
}

/**
 * Throws a customer-friendly error when an order asks for more than is free:
 * stock left minus what other open orders are already holding.
 * Pass `excludeOrderId` to re-check an order that was just saved.
 */
export async function assertStockAvailable(
  supabase: SupabaseClient,
  items: Array<OrderItemJson & { title: string; quantity: number }>,
  options: { excludeOrderId?: string } = {},
): Promise<void> {
  const rows = await loadStockRows(supabase, items);
  const wanted = new Map<string, { row: StockRow; qty: number; title: string }>();
  for (const item of items) {
    const row = matchStock(item, rows);
    if (!row) continue;
    const entry = wanted.get(row.id) ?? { row, qty: 0, title: item.title };
    entry.qty += item.quantity;
    wanted.set(row.id, entry);
  }
  if (!wanted.size) return;
  const held = await heldByOpenOrders(
    supabase,
    [...wanted.values()].map((w) => w.row),
    options.excludeOrderId,
  );
  for (const { row, qty, title } of wanted.values()) {
    const free = Math.max(row.stock_in - row.sold - (held.get(row.id) ?? 0), 0);
    if (qty > free) {
      throw new Error(
        free === 0
          ? `${title} is sold out`
          : `Only ${free} left of ${title}. Please lower the quantity.`,
      );
    }
  }
}

/** Lines of this order whose stock is now at or below the low-stock level. */
async function lowStockLines(supabase: SupabaseClient, items: OrderItemJson[]): Promise<string[]> {
  try {
    const rows = await loadStockRows(supabase, items);
    const seen = new Set<string>();
    const lines: string[] = [];
    for (const item of items) {
      const row = matchStock(item, rows);
      if (!row || seen.has(row.id) || row.archived) continue;
      seen.add(row.id);
      const left = row.stock_in - row.sold;
      if (left <= row.low_stock_at) {
        const variant = [row.size === "Default" ? "" : row.size, row.color].filter(Boolean).join(" ");
        lines.push(
          `• ${escapeHtml(row.name)}${variant ? ` (${escapeHtml(variant)})` : ""} — ${
            left <= 0 ? "SOLD OUT" : `${left} left`
          }`,
        );
      }
    }
    return lines;
  } catch (error) {
    console.error("[lowStockLines]", error);
    return [];
  }
}

/**
 * POS payment method for an online order, using the same names as the till
 * (see PAYMENT_METHODS in src/lib/pos/types.ts) so the cash-up counts it right.
 *  - khqr       → paid by KHQR through PayWay, confirmed automatically
 *  - aba_manual → customer paid the shop's ABA QR, checked by hand
 *  - cod        → cash collected at the door
 */
export function posPaymentMethod(method: PaymentMethodDb | null | undefined): string {
  switch (method) {
    case "khqr":
      return "Bakong/KHQR";
    case "aba_manual":
      return "ABA";
    default:
      return "cash";
  }
}

/** Tell the shop that some order lines were sold without moving any stock. Never throws. */
async function alertUnmatchedLines(
  supabase: SupabaseClient,
  order: OrderRecord,
  unmatched: string[],
): Promise<void> {
  if (!unmatched.length) return;
  const ref = orderRef(order);
  const base = appUrl();
  const html = [
    `⚠️ <b>Stock not deducted for order ${escapeHtml(ref)}</b>`,
    "These items have no matching stock row, so stock did not change:",
    ...unmatched.map((title) => `• ${escapeHtml(title)}`),
    "",
    "Link the product to a stock item, then adjust the stock by hand.",
    base ? `<a href="${escapeHtml(`${base}/admin/orders`)}">Open orders</a>` : "",
  ]
    .filter(Boolean)
    .join("\n");
  await notifyAdmins(supabase, {
    type: "payment_issue",
    title: `Stock not deducted · ${ref}`,
    message: `No stock row for: ${unmatched.join(", ")}`,
    data: { orderId: order.id, link: "/admin/orders" },
    telegram: { html },
  });
}

/**
 * Mirror an online order's lifecycle into the POS:
 *  - paid / done → record a POS sale via record_online_sale (deducts stock,
 *    posts the money to the cash book). Idempotent per order.
 *  - shipped     → mark the linked sale as sent.
 *  - done        → mark the linked sale as delivered.
 *  - cancelled   → cancel the linked sale (restocks items, posts a refund).
 * Lines with no stock row are still sold, but the shop gets a Telegram alert.
 */
export async function syncOrderWithPos(
  supabase: SupabaseClient,
  orderId: string,
  status: OrderStatusDb,
): Promise<void> {
  const { data: existingSale, error: saleError } = await supabase
    .from("sales")
    .select("id, status")
    .eq("order_id", orderId)
    .maybeSingle();
  if (saleError) throw new Error(saleError.message);

  if (status === "cancelled") {
    if (existingSale && existingSale.status !== "cancelled") {
      const { error } = await supabase.rpc("cancel_sale", { target_sale: existingSale.id });
      if (error) throw new Error(error.message);
    }
    return;
  }

  if ((status === "shipped" || status === "done") && existingSale) {
    const { error } = await supabase
      .from("sales")
      .update({ delivery_status: status === "shipped" ? "sent" : "delivered" })
      .eq("id", existingSale.id);
    if (error) throw new Error(error.message);
    return;
  }

  // Only paid / done create a sale (pending and shipped do not).
  if ((status !== "paid" && status !== "done") || existingSale) return;

  const order = await getOrder(supabase, orderId);
  const lines = await buildSaleLines(supabase, order.items ?? []);
  const { error } = await supabase.rpc("record_online_sale", {
    payload: {
      orderId,
      soldAt: shopToday(),
      customerName: order.customer_name || "Online customer",
      phone: order.phone ?? "",
      address: order.address ?? "",
      city: "",
      channel: "online",
      deliveryMethod: "Delivery",
      deliveryFee: 0,
      deliveryStatus: status === "done" ? "delivered" : "preparing",
      discount: 0,
      paid: Number(order.total) || 0,
      paymentMethod: posPaymentMethod(order.payment_method),
      note: `Online order ${orderRef(order)}`,
      items: lines,
    },
  });
  if (error) throw new Error(error.message);

  await alertUnmatchedLines(
    supabase,
    order,
    lines.filter((line) => !line.stockItemId).map((line) => line.name),
  );
}

// ── Status changes ───────────────────────────────────────────

const CUSTOMER_MESSAGES: Partial<Record<OrderStatusDb, { title: string; message: string }>> = {
  paid: { title: "Payment received", message: "We received your payment and are preparing your order." },
  shipped: { title: "Your order is on the way", message: "Your order has left the shop. Please keep your phone nearby." },
  done: { title: "Order delivered", message: "Your order was delivered. Thank you for shopping with BillieGrace!" },
  cancelled: { title: "Order cancelled", message: "Your order was cancelled. Contact us if you have any questions." },
};

async function notifyCustomerOfStatus(
  supabase: SupabaseClient,
  order: OrderRecord,
  status: OrderStatusDb,
): Promise<void> {
  const text = CUSTOMER_MESSAGES[status];
  if (!text) return;
  await notifyCustomer(supabase, order.user_id, {
    type: "order_update",
    title: `${text.title} · ${orderRef(order)}`,
    message: text.message,
    data: { orderId: order.id, status, link: "/orders" },
  });
}

/**
 * Change an order's status (admin page or Telegram button): saves it,
 * syncs the POS / stock and tells the customer. Throws if the POS sync fails
 * (the status is still saved). `actor` is an admin user id or a label such as
 * "Telegram: Nata"; it is written to the audit log.
 */
export async function applyOrderStatus(
  supabase: SupabaseClient,
  orderId: string,
  status: OrderStatusDb,
  actor?: string,
): Promise<OrderRecord> {
  const before = await getOrder(supabase, orderId);
  const patch: Record<string, unknown> = { status };
  if ((status === "paid" || status === "done") && !before.paid_at) {
    patch.paid_at = new Date().toISOString();
  }
  const { error } = await writeWithActor(
    (row) => supabase.from("orders").update(row).eq("id", orderId),
    patch,
    actor,
  );
  if (error) throw new Error(error.message);
  const order = { ...before, ...patch } as OrderRecord;

  if (before.status !== status) await notifyCustomerOfStatus(supabase, order, status);

  try {
    await syncOrderWithPos(supabase, orderId, status);
  } catch (syncError) {
    throw new Error(
      `Status saved, but POS sync failed: ${
        syncError instanceof Error ? syncError.message : String(syncError)
      }`,
    );
  }
  return order;
}

// ── New orders ───────────────────────────────────────────────

/** Alert the shop about a new order. KHQR orders alert when the money arrives instead. */
export async function announceNewOrder(supabase: SupabaseClient, order: OrderRecord): Promise<void> {
  const ref = orderRef(order);
  await notifyCustomer(supabase, order.user_id, {
    type: "order_update",
    title: `Order placed · ${ref}`,
    message:
      order.payment_method === "khqr"
        ? `Scan the KHQR to pay ${money(order.total, order.currency)}. We start preparing as soon as the payment arrives.`
        : order.payment_method === "aba_manual"
          ? `We'll check your ABA payment of ${money(order.total, order.currency)} and then arrange delivery.`
          : `Please prepare ${money(order.total, order.currency)} in cash for the delivery.`,
    data: { orderId: order.id, link: order.payment_method === "khqr" ? `/pay/${order.id}` : "/orders" },
  });

  if (order.payment_method === "khqr") return;

  const heading =
    order.payment_method === "aba_manual"
      ? "🧾 <b>New order — customer says they paid by ABA QR</b>\nCheck your ABA app, then tap the button below."
      : "🛍 <b>New order — cash on delivery</b>";
  await notifyAdmins(supabase, {
    type: "new_order",
    title: `New order ${ref} · ${money(order.total, order.currency)}`,
    message: `${order.customer_name} · ${PAYMENT_METHOD_LABEL[order.payment_method]}`,
    data: { orderId: order.id, link: "/admin/orders" },
    telegram: { html: `${heading}\n\n${orderSummaryHtml(order)}`, buttons: orderButtons(order) },
  });
}

// ── Automatic KHQR confirmation ──────────────────────────────

export type PaymentDetails = {
  tranId: string;
  apv?: string | null;
  paidAmount?: number | null;
  paidCurrency?: string | null;
  bankName?: string | null;
  payerAccount?: string | null;
  paymentType?: string | null;
  raw?: unknown;
};

/**
 * Mark a KHQR order paid after ABA confirmed the money. Idempotent: the
 * conditional update means only the first caller (callback or polling) wins.
 * Returns true when this call marked it paid.
 */
export async function markOrderPaidByKhqr(
  supabase: SupabaseClient,
  orderId: string,
  details: PaymentDetails,
): Promise<boolean> {
  const paidAt = new Date().toISOString();

  await supabase
    .from("payments")
    .update({
      status: "approved",
      apv: details.apv ?? null,
      paid_amount: details.paidAmount ?? null,
      paid_currency: details.paidCurrency ?? null,
      bank_name: details.bankName ?? null,
      payer_account: details.payerAccount ?? null,
      payment_type: details.paymentType ?? null,
      raw: (details.raw as object) ?? null,
      paid_at: paidAt,
      updated_at: paidAt,
    })
    .eq("tran_id", details.tranId);

  const { data: updated, error } = await writeWithActor(
    (row) =>
      supabase
        .from("orders")
        .update(row)
        .eq("id", orderId)
        .in("status", ["pending", "cancelled"])
        .select(ORDER_COLUMNS),
    { status: "paid", paid_at: paidAt, bakong_transaction_id: details.tranId },
    "KHQR (automatic)",
  );
  if (error) throw new Error(error.message);
  if (!updated || updated.length === 0) return false;
  const order = updated[0] as unknown as OrderRecord;

  let syncProblem: string | null = null;
  try {
    await syncOrderWithPos(supabase, order.id, "paid");
  } catch (syncError) {
    syncProblem = syncError instanceof Error ? syncError.message : String(syncError);
    console.error("[markOrderPaidByKhqr] POS sync failed:", syncProblem);
  }

  const ref = orderRef(order);
  const from = [details.bankName, details.payerAccount].filter(Boolean).join(" · ");
  const lowStock = await lowStockLines(supabase, order.items ?? []);
  const html = [
    `💰 <b>Payment received ${money(details.paidAmount ?? order.total, details.paidCurrency || order.currency)}</b>`,
    from ? `From: ${escapeHtml(from)}` : null,
    details.apv ? `ABA approval code: ${escapeHtml(details.apv)}` : null,
    "",
    orderSummaryHtml(order),
    lowStock.length ? `\n⚠️ <b>Running low:</b>\n${lowStock.join("\n")}` : null,
    syncProblem ? `\n❗ Stock was not deducted: ${escapeHtml(syncProblem)}` : null,
  ]
    .filter((line) => line !== null)
    .join("\n");

  await Promise.allSettled([
    notifyAdmins(supabase, {
      type: "payment_received",
      title: `Paid ${money(details.paidAmount ?? order.total, details.paidCurrency || order.currency)} · ${ref}`,
      message: `${order.customer_name}${from ? ` · ${from}` : ""}`,
      data: { orderId: order.id, tranId: details.tranId, link: "/admin/orders" },
      telegram: { html, buttons: orderButtons(order) },
    }),
    notifyCustomerOfStatus(supabase, order, "paid"),
    syncProblem
      ? notifyAdmins(supabase, {
          type: "payment_issue",
          title: `Check stock for ${ref}`,
          message: `The order is paid, but stock could not be deducted: ${syncProblem}`,
          data: { orderId: order.id, link: "/admin/orders" },
        })
      : Promise.resolve(),
  ]);
  return true;
}
