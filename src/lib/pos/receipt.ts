/**
 * Print helpers for the back office: thermal-style sale receipts and the
 * end-of-day (Z) cash report. Everything renders as plain HTML in a popup
 * window sized for an 80mm receipt printer — no dependencies, works with
 * any browser print dialog.
 */
import type { Sale } from "./types";

const SHOP_NAME = "BillieGrace Closet";
const RECEIPT_FOOTER = "Thanks for shopping with us! Exchanges within 7 days with this receipt.";

function money(value: number): string {
  return `$${(Number.isFinite(value) ? value : 0).toFixed(2)}`;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function openPrintWindow(bodyHtml: string): void {
  if (typeof window === "undefined") throw new Error("Printing is only available in the browser");
  const win = window.open("", "_blank", "width=420,height=720");
  if (!win) {
    throw new Error("Pop-up blocked — allow pop-ups for this site to print receipts.");
  }
  win.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(SHOP_NAME)}</title>
<style>
  @page { margin: 0; size: 80mm auto; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 80mm; padding: 4mm 3mm;
    font-family: "Courier New", ui-monospace, monospace;
    font-size: 12px; line-height: 1.45; color: #000; background: #fff;
  }
  h1 { font-size: 16px; text-align: center; letter-spacing: 1px; }
  .center { text-align: center; }
  .muted { color: #444; }
  hr { border: none; border-top: 1px dashed #000; margin: 2mm 0; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; padding: 0.5mm 0; }
  .r { text-align: right; white-space: nowrap; }
  .total { font-size: 14px; font-weight: bold; }
  .banner { text-align: center; font-weight: bold; margin: 2mm 0; letter-spacing: 1px; }
  @media print { body { width: auto; } }
</style>
</head>
<body>${bodyHtml}
<script>window.onload = function () { window.focus(); window.print(); };</script>
</body>
</html>`);
  win.document.close();
}

/** Optional till details that are not stored on the sale itself. */
export interface ReceiptExtras {
  /** Cash the customer handed over, when more than the amount paid. */
  cashGiven?: number;
}

/**
 * Receipt date line. `soldAt` is a calendar date (no time), so it is read as a
 * local date; the time comes from `createdAt` when the sale was entered that day.
 */
function receiptDateLine(sale: Sale): string {
  const [year, month, day] = sale.soldAt.split("-").map(Number);
  const date = year && month && day ? new Date(year, month - 1, day) : new Date(sale.createdAt);
  const created = new Date(sale.createdAt);
  const sameDay =
    !Number.isNaN(created.getTime()) &&
    created.getFullYear() === date.getFullYear() &&
    created.getMonth() === date.getMonth() &&
    created.getDate() === date.getDate();
  const time = sameDay
    ? ` ${created.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    : "";
  return `${date.toLocaleDateString()}${time}`;
}

function changeDue(sale: Sale, extras: ReceiptExtras): number {
  return extras.cashGiven && extras.cashGiven > sale.paid ? extras.cashGiven - sale.paid : 0;
}

/** Thermal-style receipt for a sale (works for cancelled/refunded sales too). */
export function printSaleReceipt(sale: Sale, extras: ReceiptExtras = {}): void {
  const dateLine = receiptDateLine(sale);
  const change = changeDue(sale, extras);

  const items = sale.items
    .map(
      (item) => `<tr>
        <td>${esc(item.name)}${item.size ? ` <span class="muted">${esc(item.size)}</span>` : ""}${item.color ? ` <span class="muted">${esc(item.color)}</span>` : ""}<br /><span class="muted">${item.qty} × ${money(item.unitPrice)}</span></td>
        <td class="r">${money(item.qty * item.unitPrice)}</td>
      </tr>`,
    )
    .join("");

  const totals = [
    `<tr><td>Subtotal</td><td class="r">${money(sale.subtotal)}</td></tr>`,
    sale.discount > 0
      ? `<tr><td>Discount</td><td class="r">−${money(sale.discount)}</td></tr>`
      : "",
    sale.deliveryFee > 0
      ? `<tr><td>Delivery</td><td class="r">${money(sale.deliveryFee)}</td></tr>`
      : "",
    `<tr><td class="total">Total</td><td class="r total">${money(sale.total)}</td></tr>`,
    `<tr><td>Paid</td><td class="r">${money(sale.paid)}</td></tr>`,
    change > 0
      ? `<tr><td>Cash given</td><td class="r">${money(extras.cashGiven ?? 0)}</td></tr><tr><td>Change</td><td class="r">${money(change)}</td></tr>`
      : "",
    Math.max(sale.total - sale.paid, 0) > 0
      ? `<tr><td class="total">Balance due</td><td class="r total">${money(sale.total - sale.paid)}</td></tr>`
      : "",
  ].join("");

  openPrintWindow(`
    <h1>${esc(SHOP_NAME)}</h1>
    ${sale.status === "cancelled" ? '<p class="banner">*** CANCELLED — REFUNDED ***</p>' : ""}
    <p class="center muted">Receipt ${esc(sale.code)}</p>
    <p class="center muted">${esc(dateLine)} · ${esc(sale.channel)}</p>
    <hr />
    <table>${items}</table>
    <hr />
    <table>${totals}</table>
    <hr />
    <p class="muted">Paid by: ${esc(sale.paymentMethod)}</p>
    ${sale.customerName ? `<p class="muted">Customer: ${esc(sale.customerName)}</p>` : ""}
    ${sale.deliveryMethod && sale.deliveryMethod !== "Pickup" ? `<p class="muted">Delivery: ${esc([sale.deliveryMethod, sale.city].filter(Boolean).join(", "))}</p>` : ""}
    <hr />
    <p class="center">${esc(RECEIPT_FOOTER)}</p>
  `);
}

/** Plain-text receipt for Telegram / Messenger / SMS. */
export function saleReceiptText(sale: Sale, extras: ReceiptExtras = {}): string {
  const change = changeDue(sale, extras);
  const balance = Math.max(sale.total - sale.paid, 0);
  const lines = [
    SHOP_NAME,
    `Receipt ${sale.code} · ${receiptDateLine(sale)}`,
    sale.status === "cancelled" ? "*** CANCELLED — REFUNDED ***" : "",
    "",
    ...sale.items.map((item) => {
      const variant = [item.size, item.color].filter(Boolean).join(" ");
      return `${item.qty} × ${item.name}${variant ? ` (${variant})` : ""} — ${money(item.qty * item.unitPrice)}`;
    }),
    "",
    sale.discount > 0 ? `Discount: −${money(sale.discount)}` : "",
    sale.deliveryFee > 0 ? `Delivery: ${money(sale.deliveryFee)}` : "",
    `Total: ${money(sale.total)}`,
    `Paid (${sale.paymentMethod}): ${money(sale.paid)}`,
    change > 0 ? `Change: ${money(change)}` : "",
    balance > 0 ? `Balance due: ${money(balance)}` : "",
    "",
    RECEIPT_FOOTER,
  ];
  return lines
    .filter((line, index, all) => line !== "" || (all[index - 1] ?? "") !== "")
    .join("\n")
    .trim();
}

/**
 * Share the receipt with the phone's share sheet (Telegram, Messenger…).
 * Falls back to copying the text when the browser has no share sheet.
 * Returns "copied" so the caller can tell the user to paste it.
 */
export async function shareSaleReceipt(
  sale: Sale,
  extras: ReceiptExtras = {},
): Promise<"shared" | "copied" | "cancelled"> {
  const text = saleReceiptText(sale, extras);
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title: `${SHOP_NAME} receipt ${sale.code}`, text });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      // Any other failure (e.g. not allowed on this page): fall back to copying.
    }
  }
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    throw new Error("This browser cannot share or copy text");
  }
  await navigator.clipboard.writeText(text);
  return "copied";
}

export interface EndOfDayReport {
  date: string;
  /** Confirmed sales that happened on the date. */
  salesCount: number;
  billed: number;
  /** Collected amounts grouped by payment method (sales + balance payments). */
  collectedByMethod: Array<{ method: string; amount: number }>;
  refunds: number;
  openingFloat: number;
  cashIn: number;
  cashOut: number;
  expectedCash: number;
  countedCash: number | null;
}

/** End-of-day (Z) report with the cash drawer reconciliation. */
export function printEndOfDayReport(report: EndOfDayReport): void {
  const difference =
    report.countedCash === null
      ? null
      : Math.round((report.countedCash - report.expectedCash) * 100) / 100;

  const methods = report.collectedByMethod
    .map(
      ({ method, amount }) =>
        `<tr><td>${esc(method)}</td><td class="r">${money(amount)}</td></tr>`,
    )
    .join("");

  openPrintWindow(`
    <h1>${esc(SHOP_NAME)}</h1>
    <p class="center muted">End-of-day report</p>
    <p class="center muted">${esc(report.date)} · printed ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
    <hr />
    <table>
      <tr><td>Sales</td><td class="r">${report.salesCount}</td></tr>
      <tr><td>Billed</td><td class="r">${money(report.billed)}</td></tr>
      ${report.refunds > 0 ? `<tr><td>Refunds</td><td class="r">−${money(report.refunds)}</td></tr>` : ""}
    </table>
    <hr />
    <p class="muted">Collected by method</p>
    <table>${methods}</table>
    <hr />
    <table>
      <tr><td>Opening float</td><td class="r">${money(report.openingFloat)}</td></tr>
      <tr><td>Cash in</td><td class="r">+${money(report.cashIn)}</td></tr>
      <tr><td>Cash out</td><td class="r">−${money(report.cashOut)}</td></tr>
      <tr><td class="total">Expected in drawer</td><td class="r total">${money(report.expectedCash)}</td></tr>
      ${report.countedCash !== null ? `<tr><td>Counted</td><td class="r">${money(report.countedCash)}</td></tr>` : ""}
      ${difference !== null ? `<tr><td class="total">${difference === 0 ? "Difference" : difference > 0 ? "Over" : "Short"}</td><td class="r total">${money(Math.abs(difference))}${difference === 0 ? " — exact" : ""}</td></tr>` : ""}
    </table>
    <hr />
    <p class="center muted">Sign: ______________________</p>
  `);
}