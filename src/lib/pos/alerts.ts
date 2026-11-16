/**
 * Telegram alerts to the shop owner: each sale (with low-stock warnings)
 * and the end-of-day report. Alerts never block the till — failures are
 * logged and reported back, not thrown.
 */
import { sendShopAlert } from "../api/telegram.functions";
import { getSupabaseAccessToken } from "../authToken";
import type { EndOfDayReport } from "./receipt";
import { usingCloud } from "./store";
import { balanceOwed, isLowStock, saleProfit, stockLeft, type Sale, type StockItem } from "./types";

const money = (value: number) => `$${(Number.isFinite(value) ? value : 0).toFixed(2)}`;

export async function sendOwnerAlert(
  text: string,
): Promise<{ ok: boolean; reason: string | null }> {
  // The bot runs on the server with the Supabase login; offline mode has neither.
  if (!usingCloud) return { ok: false, reason: "Telegram alerts need the cloud (Supabase) mode" };
  try {
    const accessToken = await getSupabaseAccessToken();
    const result = await sendShopAlert({ data: { accessToken, text } });
    return { ok: result.ok, reason: result.reason ?? null };
  } catch (error) {
    console.error("[ShopAlert] failed:", error);
    return { ok: false, reason: error instanceof Error ? error.message : "Could not send" };
  }
}

/** Stock items from this sale that are now at or below their low-stock level. */
export function lowStockAfterSale(sale: Sale, stock: StockItem[]): StockItem[] {
  const soldIds = new Set(sale.items.map((item) => item.stockItemId).filter(Boolean));
  return stock.filter((item) => soldIds.has(item.id) && isLowStock(item));
}

/** Join message lines: `null` lines are skipped, "" is a deliberate blank line (never doubled). */
function joinLines(lines: Array<string | null>): string {
  return lines
    .filter((line): line is string => line !== null)
    .filter((line, index, all) => line !== "" || (all[index - 1] ?? "") !== "")
    .join("\n")
    .trim();
}

export function saleAlertText(sale: Sale, lowStock: StockItem[] = []): string {
  const owed = balanceOwed(sale);
  const lines: Array<string | null> = [
    `🛍 New sale ${sale.code} — ${money(sale.total)}`,
    ...sale.items.map((item) => {
      const variant = [item.size, item.color].filter(Boolean).join(" ");
      return `• ${item.qty} × ${item.name}${variant ? ` (${variant})` : ""} — ${money(item.qty * item.unitPrice)}`;
    }),
    sale.discount > 0 ? `Discount: −${money(sale.discount)}` : null,
    `Paid ${money(sale.paid)} by ${sale.paymentMethod}${owed > 0 ? ` · owes ${money(owed)}` : ""}`,
    `Profit: ${money(saleProfit(sale))}`,
    sale.customerName && sale.customerName !== "Walk-in customer"
      ? `Customer: ${sale.customerName}${sale.phone ? ` (${sale.phone})` : ""}`
      : null,
  ];
  if (lowStock.length > 0) {
    lines.push(
      "",
      "⚠️ Running low:",
      ...lowStock.map((item) => {
        const variant = [item.size, item.color].filter(Boolean).join(" ");
        const left = stockLeft(item);
        return `• ${item.name}${variant ? ` (${variant})` : ""} — ${left <= 0 ? "SOLD OUT" : `${left} left`}`;
      }),
    );
  }
  return joinLines(lines);
}

export function endOfDayAlertText(report: EndOfDayReport): string {
  const difference =
    report.countedCash === null
      ? null
      : Math.round((report.countedCash - report.expectedCash) * 100) / 100;
  return joinLines([
    `📊 End of day ${report.date}`,
    `Sales: ${report.salesCount} · billed ${money(report.billed)}`,
    report.refunds > 0 ? `Refunds: −${money(report.refunds)}` : null,
    "",
    "Collected:",
    ...(report.collectedByMethod.length > 0
      ? report.collectedByMethod.map(({ method, amount }) => `• ${method}: ${money(amount)}`)
      : ["• nothing"]),
    "",
    `Cash expected in drawer: ${money(report.expectedCash)}`,
    report.countedCash !== null
      ? `Cash counted: ${money(report.countedCash)}`
      : "Cash not counted yet",
    difference === null
      ? null
      : difference === 0
        ? "✅ Drawer is exact"
        : `${difference > 0 ? "Over" : "❗ Short"}: ${money(Math.abs(difference))}`,
  ]);
}
