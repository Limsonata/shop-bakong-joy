// Server-only: the evening Telegram summary (sales, cash, low stock, deliveries
// still to send, money owed) plus a JSON backup of the shop's data.
// Runs from the Vercel cron at /api/cron/daily-summary, or on demand from Reports.
import type { SupabaseClient } from "@supabase/supabase-js";
import { lowStockProducts, type StockItem } from "@/lib/pos/types";
import { getEnv, shopToday } from "./supabaseAdmin";
import { escapeHtml, sendAdminTelegram, sendAdminTelegramDocument } from "./telegram";

const money = (value: number) => `$${(Number.isFinite(value) ? value : 0).toFixed(2)}`;
const round2 = (value: number) => Math.round(value * 100) / 100;

type SaleRow = {
  id: string;
  code: string;
  sold_at: string;
  customer_name: string;
  channel: string;
  delivery_method: string;
  delivery_status: string;
  status: string;
  total: number | string;
  paid: number | string;
};

type FinanceRow = {
  kind: "income" | "expense";
  category: string;
  amount: number | string;
  method: string;
};

type StockRow = {
  id: string;
  sku: string;
  name: string;
  category: string;
  size: string;
  color: string;
  cost: number | string;
  price: number | string;
  stock_in: number;
  sold: number;
  low_stock_at: number;
  archived: boolean;
  note: string | null;
  updated_at: string;
  product_id: string | null;
};

async function rows<T>(
  query: PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

function toStockItem(row: StockRow): StockItem {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    category: row.category,
    size: row.size,
    color: row.color,
    cost: Number(row.cost),
    price: Number(row.price),
    stockIn: row.stock_in,
    sold: row.sold,
    lowStockAt: row.low_stock_at,
    archived: row.archived,
    note: row.note ?? "",
    updatedAt: row.updated_at,
    productId: row.product_id,
  };
}

export async function buildDailySummary(
  supabase: SupabaseClient,
  date = shopToday(),
): Promise<string> {
  const [todaySales, entries, openSales, stock, paidOrders] = await Promise.all([
    rows<SaleRow>(
      supabase
        .from("sales")
        .select(
          "id, code, sold_at, customer_name, channel, delivery_method, delivery_status, status, total, paid",
        )
        .eq("sold_at", date),
    ),
    rows<FinanceRow>(
      supabase
        .from("finance_entries")
        .select("kind, category, amount, method")
        .eq("entry_date", date),
    ),
    rows<SaleRow>(
      supabase
        .from("sales")
        .select(
          "id, code, sold_at, customer_name, channel, delivery_method, delivery_status, status, total, paid",
        )
        .eq("status", "confirmed")
        .order("sold_at", { ascending: false })
        .limit(5000),
    ),
    rows<StockRow>(supabase.from("stock_items").select("*").eq("archived", false)),
    rows<{ id: string }>(supabase.from("orders").select("id").eq("status", "paid")),
  ]);

  const live = todaySales.filter((sale) => sale.status === "confirmed");
  const cancelled = todaySales.length - live.length;
  const billed = round2(live.reduce((sum, sale) => sum + Number(sale.total), 0));
  const byChannel = new Map<string, number>();
  for (const sale of live) byChannel.set(sale.channel, (byChannel.get(sale.channel) ?? 0) + 1);

  const collected = new Map<string, number>();
  let cashIn = 0;
  let cashOut = 0;
  let expenses = 0;
  let refunds = 0;
  for (const entry of entries) {
    const amount = Number(entry.amount);
    if (entry.kind === "income")
      collected.set(entry.method, round2((collected.get(entry.method) ?? 0) + amount));
    if (entry.method === "cash") {
      if (entry.kind === "income") cashIn += amount;
      else cashOut += amount;
    }
    if (entry.kind === "expense") {
      if (entry.category === "Refund") refunds += amount;
      else expenses += amount;
    }
  }

  const toSend = openSales.filter(
    (sale) => sale.delivery_status === "preparing" && sale.delivery_method !== "Pickup",
  );
  const owing = openSales.filter((sale) => Number(sale.total) - Number(sale.paid) > 0.004);
  const owed = round2(owing.reduce((sum, sale) => sum + Number(sale.total) - Number(sale.paid), 0));
  const low = lowStockProducts(stock.map(toStockItem));

  const base = (getEnv("APP_URL") || getEnv("VITE_APP_URL"))?.replace(/\/$/, "");
  const lines: Array<string | null> = [
    `🌙 <b>Daily summary · ${escapeHtml(date)}</b>`,
    "",
    `<b>Sales:</b> ${live.length} · billed ${money(billed)}`,
    byChannel.size
      ? [...byChannel.entries()]
          .map(([channel, count]) => `${escapeHtml(channel)} ${count}`)
          .join(" · ")
      : null,
    cancelled > 0 ? `Cancelled today: ${cancelled}` : null,
    "",
    "<b>Money in:</b>",
    ...(collected.size
      ? [...collected.entries()].map(
          ([method, amount]) => `• ${escapeHtml(method)}: ${money(amount)}`,
        )
      : ["• nothing"]),
    `<b>Cash drawer:</b> +${money(cashIn)} / −${money(cashOut)} = ${money(cashIn - cashOut)}`,
    expenses > 0 ? `Expenses today: ${money(expenses)}` : null,
    refunds > 0 ? `Refunds today: ${money(refunds)}` : null,
    "",
    `<b>To send:</b> ${toSend.length} deliver${toSend.length === 1 ? "y" : "ies"} not sent` +
      (paidOrders.length
        ? ` · ${paidOrders.length} paid online order${paidOrders.length === 1 ? "" : "s"} to pack`
        : ""),
    ...toSend
      .slice(0, 8)
      .map((sale) => `• ${escapeHtml(sale.code)} ${escapeHtml(sale.customer_name)}`),
    "",
    `<b>Owed by customers:</b> ${money(owed)} (${owing.length})`,
    "",
    `<b>Low stock:</b> ${low.length} product${low.length === 1 ? "" : "s"}`,
    ...low
      .slice(0, 10)
      .map(
        (product) =>
          `• ${escapeHtml(product.name)} — ${product.left <= 0 ? "SOLD OUT" : `${product.left} left`}` +
          (product.soldOutVariants.length && product.left > 0
            ? ` (out: ${escapeHtml(product.soldOutVariants.join(", "))})`
            : ""),
      ),
    low.length > 10 ? `…and ${low.length - 10} more` : null,
    base ? `\n<a href="${escapeHtml(`${base}/admin`)}">Open the dashboard</a>` : null,
  ];
  return lines
    .filter((line): line is string => line !== null)
    .filter((line, index, all) => line !== "" || (all[index - 1] ?? "") !== "")
    .join("\n")
    .trim();
}

/** Full JSON copy of the shop data, for the nightly backup file. */
export async function buildBackup(supabase: SupabaseClient): Promise<string> {
  const since = new Date(Date.now() - 120 * 86_400_000).toISOString();
  const [stockItems, sales, financeEntries, orders, products, movements] = await Promise.all([
    rows(supabase.from("stock_items").select("*")),
    rows(
      supabase
        .from("sales")
        .select("*, sale_items(*)")
        .order("sold_at", { ascending: false })
        .limit(20000),
    ),
    rows(
      supabase
        .from("finance_entries")
        .select("*")
        .order("entry_date", { ascending: false })
        .limit(50000),
    ),
    rows(
      supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(20000),
    ),
    rows(supabase.from("products").select("*")),
    rows(supabase.from("stock_movements").select("*").gte("created_at", since)),
  ]);
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      stockItems,
      sales,
      financeEntries,
      orders,
      products,
      stockMovements: movements,
    },
    null,
    1,
  );
}

/** Send tonight's summary and the backup file to every admin chat. */
export async function sendDailySummary(
  supabase: SupabaseClient,
  options: { backup?: boolean } = {},
): Promise<{ summary: boolean; backup: boolean | null }> {
  const date = shopToday();
  const summary = await sendAdminTelegram(await buildDailySummary(supabase, date));
  let backup: boolean | null = null;
  if (options.backup !== false) {
    try {
      backup = await sendAdminTelegramDocument(
        `billiegrace-backup-${date}.json`,
        await buildBackup(supabase),
        `Backup ${date}. Keep this file. It holds stock, sales, the cash book and orders.`,
      );
    } catch (error) {
      console.error("[dailySummary] backup failed:", error);
      backup = false;
    }
  }
  return { summary, backup };
}
