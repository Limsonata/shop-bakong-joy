/**
 * Receipt helpers for the back office: thermal-style sale receipts and the
 * end-of-day (Z) cash report. The same markup powers an on-screen preview and
 * an in-page print area, so phones no longer depend on a pop-up window
 * (mobile browsers render those as a tiny page with no print controls).
 */
import { currentShopSettings, formatRiel } from "../shopSettings";
import type { Sale } from "./types";

const SHOP_NAME = "BillieGrace Closet";
const RECEIPT_FOOTER = "Thanks for shopping with us! Exchanges within 7 days with this receipt.";
const PRINT_AREA_ID = "receipt-print-area";

function money(value: number): string {
  return `$${(Number.isFinite(value) ? value : 0).toFixed(2)}`;
}

/** Riel equivalent for a total line, or "" when the shop has KHR switched off. */
function riel(value: number): string {
  const rate = currentShopSettings().khrRate;
  return rate > 0 ? formatRiel(value, rate) : "";
}

/** HTML row with the dollar amount and, under it, the riel amount. */
function dualRow(label: string, value: number, bold = false): string {
  const cls = bold ? ' class="total"' : "";
  const khr = riel(value);
  return `<tr><td${cls}>${label}</td><td class="r${bold ? " total" : ""}">${money(value)}${
    khr ? `<br /><span class="muted khr">${khr}</span>` : ""
  }</td></tr>`;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Print from a hidden element inside the current page instead of a pop-up.
 * `@media print` in styles.css removes the app from layout and shows only
 * this element. Chrome ignores `@page { size: 80mm auto }`, so the exact paper
 * height is measured here and written as two explicit lengths.
 */
function printHtml(html: string): void {
  if (typeof window === "undefined") throw new Error("Printing is only available in the browser");
  let area = document.getElementById(PRINT_AREA_ID);
  if (!area) {
    area = document.createElement("div");
    area.id = PRINT_AREA_ID;
    area.className = "receipt-paper";
    document.body.appendChild(area);
  }
  area.innerHTML = html;

  const measure = document.createElement("div");
  measure.className = "receipt-paper";
  measure.style.cssText = "position:absolute;left:-9999px;top:0;visibility:hidden";
  measure.innerHTML = html;
  document.body.appendChild(measure);
  const heightMm = Math.max(
    40,
    Math.ceil((measure.getBoundingClientRect().height * 25.4) / 96) + 2,
  );
  measure.remove();

  let pageStyle = document.getElementById("receipt-page-size") as HTMLStyleElement | null;
  if (!pageStyle) {
    pageStyle = document.createElement("style");
    pageStyle.id = "receipt-page-size";
    document.head.appendChild(pageStyle);
  }
  pageStyle.textContent = `@page { size: 80mm ${heightMm}mm; margin: 0; }`;

  window.print();
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

/**
 * The itemised receipt markup. Used for both the on-screen preview and the
 * printed page so the customer always sees exactly what will be printed.
 */
export function saleReceiptHtml(sale: Sale, extras: ReceiptExtras = {}): string {
  const dateLine = receiptDateLine(sale);
  const change = changeDue(sale, extras);

  const items = sale.items
    .map(
      (item) => `<tr>
        <td>${esc(item.name)}${item.size ? ` <span class="muted">${esc(item.size)}</span>` : ""}${item.color ? ` <span class="muted">${esc(item.color)}</span>` : ""}${item.returnedQty ? ` <span class="muted">(${item.returnedQty} returned)</span>` : ""}<br /><span class="muted">${item.qty} × ${money(item.unitPrice)}</span></td>
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
    dualRow("Total", sale.total, true),
    dualRow("Paid", sale.paid),
    change > 0
      ? `<tr><td>Cash given</td><td class="r">${money(extras.cashGiven ?? 0)}</td></tr>${dualRow("Change", change)}`
      : "",
    Math.max(sale.total - sale.paid, 0) > 0
      ? dualRow("Balance due", sale.total - sale.paid, true)
      : "",
  ].join("");
  const rate = currentShopSettings().khrRate;

  return `
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
    ${rate > 0 ? `<p class="muted">Rate: $1 = ៛${rate.toLocaleString("en-US")}</p>` : ""}
    ${sale.customerName ? `<p class="muted">Customer: ${esc(sale.customerName)}</p>` : ""}
    ${sale.deliveryMethod && sale.deliveryMethod !== "Pickup" ? `<p class="muted">Delivery: ${esc([sale.deliveryMethod, sale.city].filter(Boolean).join(", "))}</p>` : ""}
    <hr />
    <p class="center">${esc(RECEIPT_FOOTER)}</p>
  `;
}

/** Thermal-style receipt for a sale (works for cancelled/refunded sales too). */
export function printSaleReceipt(sale: Sale, extras: ReceiptExtras = {}): void {
  printHtml(saleReceiptHtml(sale, extras));
}

/** Plain-text receipt for Telegram / Messenger / SMS. */
export function saleReceiptText(sale: Sale, extras: ReceiptExtras = {}): string {
  const change = changeDue(sale, extras);
  const balance = Math.max(sale.total - sale.paid, 0);
  const withRiel = (value: number) => {
    const khr = riel(value);
    return khr ? `${money(value)} (${khr})` : money(value);
  };
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
    `Total: ${withRiel(sale.total)}`,
    `Paid (${sale.paymentMethod}): ${withRiel(sale.paid)}`,
    change > 0 ? `Change: ${withRiel(change)}` : "",
    balance > 0 ? `Balance due: ${withRiel(balance)}` : "",
    "",
    RECEIPT_FOOTER,
  ];
  return lines
    .filter((line, index, all) => line !== "" || (all[index - 1] ?? "") !== "")
    .join("\n")
    .trim();
}

/** Wrap long text lines so the generated image stays receipt-width. */
function wrapReceiptLines(text: string, columns: number): string[] {
  const wrapped: string[] = [];
  for (const line of text.split("\n")) {
    let rest = line;
    while (rest.length > columns) {
      let cut = rest.lastIndexOf(" ", columns);
      if (cut <= 0) cut = columns;
      wrapped.push(rest.slice(0, cut));
      rest = rest.slice(cut).trimStart();
    }
    wrapped.push(rest);
  }
  return wrapped;
}

/** Draw the plain-text receipt onto a small PNG that printer apps can open. */
async function receiptImageBlob(text: string): Promise<Blob> {
  const columns = 32;
  const lines = wrapReceiptLines(text, columns);
  const fontSize = 18;
  const lineHeight = 24;
  const padding = 24;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(columns * fontSize * 0.62 + padding * 2);
  canvas.height = Math.ceil(lines.length * lineHeight + padding * 2);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create the receipt image");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000000";
  ctx.font = `${fontSize}px "Courier New", monospace`;
  ctx.textBaseline = "top";
  lines.forEach((line, index) => ctx.fillText(line, padding, padding + index * lineHeight));
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not create the receipt image"))),
      "image/png",
    );
  });
}

/**
 * Share the receipt as a PNG through the phone's share sheet, so it can be
 * opened in a Bluetooth printer app. Falls back to sharing/copying the text.
 */
export async function shareSaleReceipt(
  sale: Sale,
  extras: ReceiptExtras = {},
): Promise<"shared" | "copied" | "cancelled"> {
  const text = saleReceiptText(sale, extras);
  if (typeof navigator !== "undefined") {
    try {
      const blob = await receiptImageBlob(text);
      const file = new File([blob], `receipt-${sale.code}.png`, { type: "image/png" });
      if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `${SHOP_NAME} receipt ${sale.code}` });
          return "shared";
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
        }
      }
    } catch {
      // Image generation is best-effort; fall through to text sharing.
    }
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: `${SHOP_NAME} receipt ${sale.code}`, text });
        return "shared";
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      }
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return "copied";
    }
  }
  throw new Error("This browser cannot share or copy the receipt");
}

/** Add-to-Home-Screen apps run standalone, where window.print() does nothing. */
export function isStandaloneWebApp(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    window.matchMedia?.("(display-mode: minimal-ui)").matches === true ||
    window.matchMedia?.("(display-mode: fullscreen)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Use the browser print dialog normally; in an installed web app open the
 * share sheet instead so the receipt can be sent to a Bluetooth printer app.
 */
export async function printOrShareSaleReceipt(
  sale: Sale,
  extras: ReceiptExtras = {},
): Promise<"printed" | "shared" | "copied" | "cancelled"> {
  if (isStandaloneWebApp()) return shareSaleReceipt(sale, extras);
  printSaleReceipt(sale, extras);
  return "printed";
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
      ({ method, amount }) => `<tr><td>${esc(method)}</td><td class="r">${money(amount)}</td></tr>`,
    )
    .join("");

  printHtml(`
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
