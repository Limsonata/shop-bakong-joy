/**
 * Shared types for the shop's POS / money-management back office.
 *
 * These mirror the tables created in
 * `supabase/migrations/20260906090000_pos_system.sql`, and replace the
 * Stock / Orders / Income & Expenses / Profit sheets of the old spreadsheet.
 */

export type StockCategory = string;

export interface StockItem {
  id: string;
  sku: string;
  name: string;
  category: StockCategory;
  size: string;
  color: string;
  /** What we paid the supplier, per unit. */
  cost: number;
  /** What the customer pays, per unit. */
  price: number;
  /** Total units ever received. */
  stockIn: number;
  /** Total units sold. */
  sold: number;
  /** Warn when stockLeft drops to this number or below. */
  lowStockAt: number;
  archived: boolean;
  note: string;
  updatedAt: string;
  /** Website product this row is linked to (set by the product↔stock sync). */
  productId?: string | null;
}

/** stockIn - sold, never below zero for display purposes. */
export function stockLeft(item: StockItem): number {
  return item.stockIn - item.sold;
}

export function isLowStock(item: StockItem): boolean {
  return !item.archived && stockLeft(item) <= item.lowStockAt;
}

/** One website product (or one name + category group) with all its size/colour rows. */
export interface LowStockProduct {
  key: string;
  name: string;
  category: string;
  /** Units left across all live sizes/colours. */
  left: number;
  /** Alert level for the product: the highest alert level of its rows. */
  alertAt: number;
  /** Sizes/colours that are sold out, for the reorder list. */
  soldOutVariants: string[];
}

/**
 * Products that need reordering, counted once per product rather than once
 * per size/colour row. Archived (retired) rows are skipped, and so are rows
 * that never received any stock: a size you never bought is not a reorder.
 * A product is low when its total units left are at or below its alert level.
 */
export function lowStockProducts(items: StockItem[]): LowStockProduct[] {
  const groups = new Map<string, StockItem[]>();
  for (const item of items) {
    if (item.archived || item.stockIn <= 0) continue;
    const key = item.productId || `${item.name.trim().toLowerCase()}|${item.category}`;
    const rows = groups.get(key);
    if (rows) rows.push(item);
    else groups.set(key, [item]);
  }

  const low: LowStockProduct[] = [];
  for (const [key, rows] of groups) {
    const left = rows.reduce((sum, row) => sum + Math.max(stockLeft(row), 0), 0);
    const alertAt = Math.max(...rows.map((row) => row.lowStockAt));
    if (left > alertAt) continue;
    low.push({
      key,
      name: rows[0].name,
      category: rows[0].category,
      left,
      alertAt,
      soldOutVariants: rows
        .filter((row) => stockLeft(row) <= 0)
        .map((row) => [row.size, row.color].filter((part) => part && part !== "Default").join(" "))
        .filter(Boolean),
    });
  }
  return low.sort((a, b) => a.left - b.left || a.name.localeCompare(b.name));
}

export function stockLabel(item: StockItem): string {
  return [item.name, item.size, item.color].filter(Boolean).join(" · ");
}

export interface StockItemInput {
  sku?: string;
  name: string;
  category: string;
  size: string;
  color: string;
  cost: number;
  price: number;
  stockIn: number;
  lowStockAt?: number;
  note?: string;
}

export type StockMovementReason = "restock" | "sale" | "return" | "adjustment" | "loss";

export interface StockMovement {
  id: string;
  stockItemId: string;
  delta: number;
  reason: StockMovementReason;
  unitCost: number | null;
  reference: string | null;
  createdAt: string;
}

export type SaleChannel = "walk-in" | "booking" | "online";
export type DeliveryStatus = "preparing" | "sent" | "delivered" | "returned";
export type SaleStatus = "confirmed" | "cancelled";

export interface SaleItem {
  id: string;
  stockItemId: string | null;
  name: string;
  size: string;
  color: string;
  qty: number;
  unitPrice: number;
  /** Cost snapshot, so profit stays correct if supplier prices change later. */
  unitCost: number;
  /** Units already returned from this line (qty is what the customer kept). */
  returnedQty?: number;
}

export interface Sale {
  id: string;
  code: string;
  soldAt: string;
  customerName: string;
  phone: string;
  address: string;
  city: string;
  channel: SaleChannel;
  deliveryMethod: string;
  deliveryFee: number;
  deliveryStatus: DeliveryStatus;
  status: SaleStatus;
  subtotal: number;
  discount: number;
  total: number;
  /** Cash received so far. Balance owed = total - paid. */
  paid: number;
  paymentMethod: string;
  note: string;
  items: SaleItem[];
  createdAt: string;
  /** Website order this sale came from (online channel only). */
  orderId?: string | null;
}

export function balanceOwed(sale: Sale): number {
  return Math.max(round2(sale.total - sale.paid), 0);
}

export function saleCost(sale: Sale): number {
  return round2(sale.items.reduce((sum, item) => sum + item.qty * item.unitCost, 0));
}

export function saleProfit(sale: Sale): number {
  return round2(sale.subtotal - sale.discount - saleCost(sale));
}

export type PaymentState = "paid" | "deposit" | "unpaid";

export function paymentState(sale: Sale): PaymentState {
  if (sale.paid <= 0) return "unpaid";
  return balanceOwed(sale) <= 0.001 ? "paid" : "deposit";
}

export interface SaleLineInput {
  stockItemId: string | null;
  name: string;
  size: string;
  color: string;
  qty: number;
  unitPrice: number;
  unitCost: number;
}

export interface SaleInput {
  soldAt: string;
  customerName: string;
  phone: string;
  address: string;
  city: string;
  channel: SaleChannel;
  deliveryMethod: string;
  deliveryFee: number;
  deliveryStatus: DeliveryStatus;
  discount: number;
  paid: number;
  paymentMethod: string;
  note: string;
  items: SaleLineInput[];
}

export type FinanceKind = "income" | "expense";
export type FinanceSource = "manual" | "sale" | "import";

export interface FinanceEntry {
  id: string;
  entryDate: string;
  kind: FinanceKind;
  description: string;
  category: string;
  amount: number;
  method: string;
  source: FinanceSource;
  saleId: string | null;
  createdAt: string;
}

export interface FinanceEntryInput {
  entryDate: string;
  kind: FinanceKind;
  description: string;
  category: string;
  amount: number;
  method: string;
}

export const EXPENSE_CATEGORIES = [
  "Inventory",
  "Delivery",
  "Supplies",
  "Marketing",
  "Rent",
  "Transport",
  "Other",
] as const;

export const INCOME_CATEGORIES = ["Sales", "Other"] as const;

/**
 * Expense categories that must NOT reduce profit:
 *  - Inventory: already counted through cost of goods sold.
 *  - Refund:    the matching sale is cancelled, so its revenue is gone too.
 * Both still move real cash, so they stay in the cash figures.
 */
export const NON_PROFIT_EXPENSE_CATEGORIES = ["Inventory", "Refund"] as const;

export function isRunningCost(category: string): boolean {
  return !NON_PROFIT_EXPENSE_CATEGORIES.includes(
    category as (typeof NON_PROFIT_EXPENSE_CATEGORIES)[number],
  );
}

/** Alert when this many or fewer are left (new stock items start here). */
export const DEFAULT_LOW_STOCK_AT = 3;

export const PAYMENT_METHODS = ["cash", "ABA", "Bakong/KHQR", "Wing", "transfer"] as const;

/**
 * Everything the old Profit sheet worked out by hand.
 *
 * Two separate views of the money, on purpose:
 *  - profit  (revenue - cost of goods sold - running costs)
 *  - cash    (what actually came in and went out of the drawer)
 */
export interface ShopSummary {
  /** Goods sold, excluding delivery fees. */
  revenue: number;
  deliveryCharged: number;
  /** Revenue + delivery = what customers were billed. */
  billed: number;
  /** Cash collected against sales. */
  collected: number;
  /** Money customers still owe on deposits. */
  outstanding: number;
  cogs: number;
  grossProfit: number;
  /** Expenses other than inventory purchases (inventory is already in COGS). */
  runningCosts: number;
  netProfit: number;
  cashIn: number;
  cashOut: number;
  cashOnHand: number;
  inventorySpend: number;
  unitsLeft: number;
  stockValue: number;
  potentialSales: number;
  /** Products (not size/colour rows) at or below their alert level. */
  lowStockCount: number;
}

export function round2(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

/**
 * Calendar date (YYYY-MM-DD) in the device's own time zone.
 * `toISOString()` is UTC, which in Cambodia (UTC+7) files anything before
 * 07:00 under the previous day.
 */
export function localDate(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
