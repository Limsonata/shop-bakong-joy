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
}

/** stockIn - sold, never below zero for display purposes. */
export function stockLeft(item: StockItem): number {
  return item.stockIn - item.sold;
}

export function isLowStock(item: StockItem): boolean {
  return !item.archived && stockLeft(item) <= item.lowStockAt;
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
  lowStockCount: number;
}

export function round2(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}
