/**
 * POS data layer: inventory, sales and the cash book.
 *
 * Backend selection matches the rest of the app — Supabase when configured
 * (`VITE_SUPABASE_URL` + key), otherwise the seeded localStorage backend so the
 * shop can work offline. Both paths expose exactly the same functions, so the
 * UI never needs to know which one is live.
 */
import { isSupabaseConfigured, supabase } from "../supabase";
import {
  mutate,
  newId,
  nextSaleCode,
  nextSku,
  readSnapshot,
  recalcSaleTotals,
  replaceSnapshot,
  resetToSeed,
  type PosSnapshot,
} from "./localBackend";
import {
  isRunningCost,
  round2,
  stockLeft,
  type FinanceEntry,
  type FinanceEntryInput,
  type Sale,
  type SaleInput,
  type SaleItem,
  type ShopSummary,
  type StockItem,
  type StockItemInput,
  type StockMovement,
} from "./types";

export const usingCloud = isSupabaseConfigured;

/** True when data lives only in this browser — the UI warns about backups. */
export const usingLocalOnly = !isSupabaseConfigured;

// ─────────────────────────────── row mappers ───────────────────────────────

interface StockRow {
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
  };
}

interface SaleItemRow {
  id: string;
  stock_item_id: string | null;
  name: string;
  size: string;
  color: string;
  qty: number;
  unit_price: number | string;
  unit_cost: number | string;
}

interface SaleRow {
  id: string;
  code: string;
  sold_at: string;
  customer_name: string;
  phone: string;
  address: string;
  city: string;
  channel: Sale["channel"];
  delivery_method: string;
  delivery_fee: number | string;
  delivery_status: Sale["deliveryStatus"];
  status: Sale["status"];
  subtotal: number | string;
  discount: number | string;
  total: number | string;
  paid: number | string;
  payment_method: string;
  note: string | null;
  created_at: string;
  sale_items?: SaleItemRow[] | null;
}

function toSale(row: SaleRow): Sale {
  return {
    id: row.id,
    code: row.code,
    soldAt: row.sold_at,
    customerName: row.customer_name,
    phone: row.phone,
    address: row.address,
    city: row.city,
    channel: row.channel,
    deliveryMethod: row.delivery_method,
    deliveryFee: Number(row.delivery_fee),
    deliveryStatus: row.delivery_status,
    status: row.status,
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    total: Number(row.total),
    paid: Number(row.paid),
    paymentMethod: row.payment_method,
    note: row.note ?? "",
    createdAt: row.created_at,
    items: (row.sale_items ?? []).map(
      (item): SaleItem => ({
        id: item.id,
        stockItemId: item.stock_item_id,
        name: item.name,
        size: item.size,
        color: item.color,
        qty: item.qty,
        unitPrice: Number(item.unit_price),
        unitCost: Number(item.unit_cost),
      }),
    ),
  };
}

interface FinanceRow {
  id: string;
  entry_date: string;
  kind: FinanceEntry["kind"];
  description: string;
  category: string;
  amount: number | string;
  method: string;
  source: FinanceEntry["source"];
  sale_id: string | null;
  created_at: string;
}

function toFinanceEntry(row: FinanceRow): FinanceEntry {
  return {
    id: row.id,
    entryDate: row.entry_date,
    kind: row.kind,
    description: row.description,
    category: row.category,
    amount: Number(row.amount),
    method: row.method,
    source: row.source,
    saleId: row.sale_id,
    createdAt: row.created_at,
  };
}

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? "unknown error"}`);
}

const SALE_SELECT = "*, sale_items(*)";

// ───────────────────────────────── stock ──────────────────────────────────

export async function listStockItems(includeArchived = false): Promise<StockItem[]> {
  if (usingCloud && supabase) {
    let query = supabase.from("stock_items").select("*").order("sku");
    if (!includeArchived) query = query.eq("archived", false);
    const { data, error } = await query;
    if (error) fail("Could not load stock", error);
    return (data as StockRow[]).map(toStockItem);
  }

  const items = readSnapshot().stockItems;
  return [...(includeArchived ? items : items.filter((item) => !item.archived))].sort((a, b) =>
    a.sku.localeCompare(b.sku, undefined, { numeric: true }),
  );
}

export async function createStockItem(input: StockItemInput): Promise<StockItem> {
  if (usingCloud && supabase) {
    const sku = input.sku?.trim() || nextSku(await listStockItems(true));
    const { data, error } = await supabase
      .from("stock_items")
      .insert({
        sku,
        name: input.name.trim(),
        category: input.category,
        size: input.size,
        color: input.color,
        cost: input.cost,
        price: input.price,
        stock_in: input.stockIn,
        low_stock_at: input.lowStockAt ?? 0,
        note: input.note ?? null,
      })
      .select("*")
      .single();
    if (error) fail("Could not add stock item", error);
    if (input.stockIn > 0) {
      await supabase.from("stock_movements").insert({
        stock_item_id: (data as StockRow).id,
        delta: input.stockIn,
        reason: "restock",
        unit_cost: input.cost,
        reference: "initial stock",
      });
    }
    return toStockItem(data as StockRow);
  }

  return mutate((snapshot) => {
    const sku = input.sku?.trim() || nextSku(snapshot.stockItems);
    if (snapshot.stockItems.some((item) => item.sku.toLowerCase() === sku.toLowerCase())) {
      throw new Error(`SKU ${sku} already exists`);
    }
    const item: StockItem = {
      id: newId("st"),
      sku,
      name: input.name.trim(),
      category: input.category,
      size: input.size,
      color: input.color,
      cost: input.cost,
      price: input.price,
      stockIn: input.stockIn,
      sold: 0,
      lowStockAt: input.lowStockAt ?? 0,
      archived: false,
      note: input.note ?? "",
      updatedAt: new Date().toISOString(),
    };
    snapshot.stockItems.push(item);
    if (input.stockIn > 0) {
      snapshot.movements.unshift({
        id: newId("mv"),
        stockItemId: item.id,
        delta: input.stockIn,
        reason: "restock",
        unitCost: input.cost,
        reference: "initial stock",
        createdAt: new Date().toISOString(),
      });
    }
    return item;
  });
}

export async function updateStockItem(
  id: string,
  patch: Partial<StockItemInput> & { archived?: boolean; sold?: number },
): Promise<StockItem> {
  if (usingCloud && supabase) {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.name !== undefined) payload.name = patch.name.trim();
    if (patch.category !== undefined) payload.category = patch.category;
    if (patch.size !== undefined) payload.size = patch.size;
    if (patch.color !== undefined) payload.color = patch.color;
    if (patch.cost !== undefined) payload.cost = patch.cost;
    if (patch.price !== undefined) payload.price = patch.price;
    if (patch.stockIn !== undefined) payload.stock_in = patch.stockIn;
    if (patch.sold !== undefined) payload.sold = patch.sold;
    if (patch.lowStockAt !== undefined) payload.low_stock_at = patch.lowStockAt;
    if (patch.note !== undefined) payload.note = patch.note;
    if (patch.archived !== undefined) payload.archived = patch.archived;

    const { data, error } = await supabase
      .from("stock_items")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
    if (error) fail("Could not update stock item", error);
    return toStockItem(data as StockRow);
  }

  return mutate((snapshot) => {
    const item = snapshot.stockItems.find((candidate) => candidate.id === id);
    if (!item) throw new Error("Stock item not found");
    Object.assign(item, {
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.category !== undefined ? { category: patch.category } : {}),
      ...(patch.size !== undefined ? { size: patch.size } : {}),
      ...(patch.color !== undefined ? { color: patch.color } : {}),
      ...(patch.cost !== undefined ? { cost: patch.cost } : {}),
      ...(patch.price !== undefined ? { price: patch.price } : {}),
      ...(patch.stockIn !== undefined ? { stockIn: patch.stockIn } : {}),
      ...(patch.sold !== undefined ? { sold: patch.sold } : {}),
      ...(patch.lowStockAt !== undefined ? { lowStockAt: patch.lowStockAt } : {}),
      ...(patch.note !== undefined ? { note: patch.note } : {}),
      ...(patch.archived !== undefined ? { archived: patch.archived } : {}),
      updatedAt: new Date().toISOString(),
    });
    return item;
  });
}

export interface RestockInput {
  stockItemId: string;
  quantity: number;
  unitCost?: number;
  supplier?: string;
  /** Post the purchase to the cash book as an Inventory expense. */
  postExpense: boolean;
}

export async function restockItem(input: RestockInput): Promise<StockItem> {
  if (input.quantity <= 0) throw new Error("Restock quantity must be greater than zero");

  if (usingCloud && supabase) {
    const { data, error } = await supabase.rpc("record_restock", {
      target_item: input.stockItemId,
      quantity: input.quantity,
      new_unit_cost: input.unitCost ?? null,
      supplier: input.supplier ?? null,
      post_expense: input.postExpense,
    });
    if (error) fail("Could not record restock", error);
    return toStockItem(data as StockRow);
  }

  return mutate((snapshot) => {
    const item = snapshot.stockItems.find((candidate) => candidate.id === input.stockItemId);
    if (!item) throw new Error("Stock item not found");
    const unitCost = input.unitCost ?? item.cost;
    item.stockIn += input.quantity;
    item.cost = unitCost;
    item.updatedAt = new Date().toISOString();

    snapshot.movements.unshift({
      id: newId("mv"),
      stockItemId: item.id,
      delta: input.quantity,
      reason: "restock",
      unitCost,
      reference: input.supplier ?? null,
      createdAt: new Date().toISOString(),
    });

    if (input.postExpense && unitCost > 0) {
      const today = new Date().toISOString().slice(0, 10);
      snapshot.financeEntries.unshift({
        id: newId("fe"),
        entryDate: today,
        kind: "expense",
        description: `Restock ${input.quantity} x ${item.name}${input.supplier ? ` (${input.supplier})` : ""}`,
        category: "Inventory",
        amount: round2(unitCost * input.quantity),
        method: "cash",
        source: "manual",
        saleId: null,
        createdAt: new Date().toISOString(),
      });
    }
    return item;
  });
}

export interface StockAdjustmentInput {
  stockItemId: string;
  delta: number;
  reason: Extract<StockMovement["reason"], "adjustment" | "loss" | "return">;
  note?: string;
}

export async function adjustStock(input: StockAdjustmentInput): Promise<StockItem> {
  if (input.delta === 0) throw new Error("Adjustment cannot be zero");

  if (usingCloud && supabase) {
    const { data: current, error: readError } = await supabase
      .from("stock_items")
      .select("*")
      .eq("id", input.stockItemId)
      .single();
    if (readError) fail("Could not load stock item", readError);
    const item = toStockItem(current as StockRow);

    const { data, error } = await supabase
      .from("stock_items")
      .update({ stock_in: item.stockIn + input.delta, updated_at: new Date().toISOString() })
      .eq("id", input.stockItemId)
      .select("*")
      .single();
    if (error) fail("Could not adjust stock", error);

    await supabase.from("stock_movements").insert({
      stock_item_id: input.stockItemId,
      delta: input.delta,
      reason: input.reason,
      reference: input.note ?? null,
    });
    return toStockItem(data as StockRow);
  }

  return mutate((snapshot) => {
    const item = snapshot.stockItems.find((candidate) => candidate.id === input.stockItemId);
    if (!item) throw new Error("Stock item not found");
    item.stockIn += input.delta;
    item.updatedAt = new Date().toISOString();
    snapshot.movements.unshift({
      id: newId("mv"),
      stockItemId: item.id,
      delta: input.delta,
      reason: input.reason,
      unitCost: null,
      reference: input.note ?? null,
      createdAt: new Date().toISOString(),
    });
    return item;
  });
}

export async function listStockMovements(limit = 60): Promise<StockMovement[]> {
  if (usingCloud && supabase) {
    const { data, error } = await supabase
      .from("stock_movements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) fail("Could not load stock movements", error);
    return (
      data as Array<{
        id: string;
        stock_item_id: string;
        delta: number;
        reason: StockMovement["reason"];
        unit_cost: number | string | null;
        reference: string | null;
        created_at: string;
      }>
    ).map((row) => ({
      id: row.id,
      stockItemId: row.stock_item_id,
      delta: row.delta,
      reason: row.reason,
      unitCost: row.unit_cost === null ? null : Number(row.unit_cost),
      reference: row.reference,
      createdAt: row.created_at,
    }));
  }
  return readSnapshot().movements.slice(0, limit);
}

// ───────────────────────────────── sales ──────────────────────────────────

export async function listSales(limit = 300): Promise<Sale[]> {
  if (usingCloud && supabase) {
    const { data, error } = await supabase
      .from("sales")
      .select(SALE_SELECT)
      .order("sold_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) fail("Could not load sales", error);
    return (data as SaleRow[]).map(toSale);
  }

  return [...readSnapshot().sales]
    .sort((a, b) =>
      a.soldAt === b.soldAt ? b.code.localeCompare(a.code) : b.soldAt.localeCompare(a.soldAt),
    )
    .slice(0, limit);
}

/**
 * Record a sale: writes the sale + lines, decrements stock and posts the cash
 * received to the ledger. On Supabase this is one atomic `record_sale` call.
 */
export async function recordSale(input: SaleInput): Promise<Sale> {
  if (input.items.length === 0) throw new Error("Add at least one item to the sale");

  if (usingCloud && supabase) {
    const { data, error } = await supabase.rpc("record_sale", {
      payload: {
        soldAt: input.soldAt,
        customerName: input.customerName,
        phone: input.phone,
        address: input.address,
        city: input.city,
        channel: input.channel,
        deliveryMethod: input.deliveryMethod,
        deliveryFee: input.deliveryFee,
        deliveryStatus: input.deliveryStatus,
        discount: input.discount,
        paid: input.paid,
        paymentMethod: input.paymentMethod,
        note: input.note,
        items: input.items,
      },
    });
    if (error) fail("Could not save the sale", error);
    const created = data as SaleRow;
    const { data: full } = await supabase
      .from("sales")
      .select(SALE_SELECT)
      .eq("id", created.id)
      .single();
    return toSale((full ?? created) as SaleRow);
  }

  return mutate((snapshot) => {
    // Validate stock before touching anything.
    for (const line of input.items) {
      if (!line.stockItemId) continue;
      const item = snapshot.stockItems.find((candidate) => candidate.id === line.stockItemId);
      if (!item) throw new Error(`${line.name} is no longer in the stock list`);
      if (stockLeft(item) < line.qty) {
        throw new Error(`Not enough stock for ${item.name} (${stockLeft(item)} left)`);
      }
    }

    const now = new Date().toISOString();
    const code = nextSaleCode(snapshot.sales);
    const sale: Sale = recalcSaleTotals({
      id: newId("sl"),
      code,
      soldAt: input.soldAt,
      customerName: input.customerName.trim() || "Walk-in customer",
      phone: input.phone.trim(),
      address: input.address.trim(),
      city: input.city.trim(),
      channel: input.channel,
      deliveryMethod: input.deliveryMethod,
      deliveryFee: input.deliveryFee,
      deliveryStatus: input.deliveryStatus,
      status: "confirmed",
      subtotal: 0,
      discount: input.discount,
      total: 0,
      paid: round2(input.paid),
      paymentMethod: input.paymentMethod,
      note: input.note.trim(),
      createdAt: now,
      items: input.items.map((line, index) => {
        const item = line.stockItemId
          ? snapshot.stockItems.find((candidate) => candidate.id === line.stockItemId)
          : undefined;
        return {
          id: `${code}_${index}`,
          stockItemId: line.stockItemId,
          name: line.name,
          size: line.size,
          color: line.color,
          qty: line.qty,
          unitPrice: line.unitPrice,
          unitCost: line.unitCost || item?.cost || 0,
        };
      }),
    });

    for (const line of sale.items) {
      if (!line.stockItemId) continue;
      const item = snapshot.stockItems.find((candidate) => candidate.id === line.stockItemId);
      if (!item) continue;
      item.sold += line.qty;
      item.updatedAt = now;
      snapshot.movements.unshift({
        id: newId("mv"),
        stockItemId: item.id,
        delta: -line.qty,
        reason: "sale",
        unitCost: line.unitCost,
        reference: sale.code,
        createdAt: now,
      });
    }

    snapshot.sales.unshift(sale);

    if (sale.paid > 0) {
      snapshot.financeEntries.unshift({
        id: newId("fe"),
        entryDate: sale.soldAt,
        kind: "income",
        description: `Sale ${sale.code} — ${sale.customerName}`,
        category: "Sales",
        amount: sale.paid,
        method: sale.paymentMethod,
        source: "sale",
        saleId: sale.id,
        createdAt: now,
      });
    }

    return sale;
  });
}

/** Collect the remaining balance (or part of it) on a booking. */
export async function addSalePayment(
  saleId: string,
  amount: number,
  method = "cash",
): Promise<Sale> {
  if (amount <= 0) throw new Error("Payment must be greater than zero");

  if (usingCloud && supabase) {
    const { error } = await supabase.rpc("record_sale_payment", {
      target_sale: saleId,
      payment_amount: amount,
      payment_method: method,
    });
    if (error) fail("Could not record the payment", error);
    const { data, error: readError } = await supabase
      .from("sales")
      .select(SALE_SELECT)
      .eq("id", saleId)
      .single();
    if (readError) fail("Could not reload the sale", readError);
    return toSale(data as SaleRow);
  }

  return mutate((snapshot) => {
    const sale = snapshot.sales.find((candidate) => candidate.id === saleId);
    if (!sale) throw new Error("Sale not found");
    sale.paid = round2(sale.paid + amount);
    const now = new Date().toISOString();
    snapshot.financeEntries.unshift({
      id: newId("fe"),
      entryDate: now.slice(0, 10),
      kind: "income",
      description: `Balance payment ${sale.code} — ${sale.customerName}`,
      category: "Sales",
      amount: round2(amount),
      method,
      source: "sale",
      saleId: sale.id,
      createdAt: now,
    });
    return sale;
  });
}

export async function updateSale(
  saleId: string,
  patch: Partial<Pick<Sale, "deliveryStatus" | "status" | "note" | "deliveryMethod">>,
): Promise<Sale> {
  if (usingCloud && supabase) {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.deliveryStatus) payload.delivery_status = patch.deliveryStatus;
    if (patch.status) payload.status = patch.status;
    if (patch.deliveryMethod) payload.delivery_method = patch.deliveryMethod;
    if (patch.note !== undefined) payload.note = patch.note;

    const { error } = await supabase.from("sales").update(payload).eq("id", saleId);
    if (error) fail("Could not update the sale", error);
    const { data, error: readError } = await supabase
      .from("sales")
      .select(SALE_SELECT)
      .eq("id", saleId)
      .single();
    if (readError) fail("Could not reload the sale", readError);
    return toSale(data as SaleRow);
  }

  return mutate((snapshot) => {
    const sale = snapshot.sales.find((candidate) => candidate.id === saleId);
    if (!sale) throw new Error("Sale not found");
    Object.assign(sale, patch);
    return sale;
  });
}

/** Cancel a sale and put the goods back on the shelf. */
export async function cancelSale(saleId: string): Promise<Sale> {
  if (usingCloud && supabase) {
    const { data: saleRow, error: readError } = await supabase
      .from("sales")
      .select(SALE_SELECT)
      .eq("id", saleId)
      .single();
    if (readError) fail("Could not load the sale", readError);
    const sale = toSale(saleRow as SaleRow);
    if (sale.status === "cancelled") return sale;

    for (const line of sale.items) {
      if (!line.stockItemId) continue;
      const { data: stockRow } = await supabase
        .from("stock_items")
        .select("*")
        .eq("id", line.stockItemId)
        .single();
      if (!stockRow) continue;
      await supabase
        .from("stock_items")
        .update({ sold: Math.max((stockRow as StockRow).sold - line.qty, 0) })
        .eq("id", line.stockItemId);
      await supabase.from("stock_movements").insert({
        stock_item_id: line.stockItemId,
        delta: line.qty,
        reason: "return",
        reference: `cancel ${sale.code}`,
      });
    }

    if (sale.paid > 0) {
      await supabase.from("finance_entries").insert({
        entry_date: new Date().toISOString().slice(0, 10),
        kind: "expense",
        description: `Refund ${sale.code} — ${sale.customerName}`,
        category: "Refund",
        amount: sale.paid,
        method: sale.paymentMethod,
        source: "sale",
        sale_id: sale.id,
      });
    }

    const { error } = await supabase
      .from("sales")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", saleId);
    if (error) fail("Could not cancel the sale", error);
    return { ...sale, status: "cancelled" };
  }

  return mutate((snapshot) => {
    const sale = snapshot.sales.find((candidate) => candidate.id === saleId);
    if (!sale) throw new Error("Sale not found");
    if (sale.status === "cancelled") return sale;

    const now = new Date().toISOString();
    for (const line of sale.items) {
      if (!line.stockItemId) continue;
      const item = snapshot.stockItems.find((candidate) => candidate.id === line.stockItemId);
      if (!item) continue;
      item.sold = Math.max(item.sold - line.qty, 0);
      item.updatedAt = now;
      snapshot.movements.unshift({
        id: newId("mv"),
        stockItemId: item.id,
        delta: line.qty,
        reason: "return",
        unitCost: line.unitCost,
        reference: `cancel ${sale.code}`,
        createdAt: now,
      });
    }

    if (sale.paid > 0) {
      snapshot.financeEntries.unshift({
        id: newId("fe"),
        entryDate: now.slice(0, 10),
        kind: "expense",
        description: `Refund ${sale.code} — ${sale.customerName}`,
        category: "Refund",
        amount: sale.paid,
        method: sale.paymentMethod,
        source: "sale",
        saleId: sale.id,
        createdAt: now,
      });
    }

    sale.status = "cancelled";
    return sale;
  });
}

// ──────────────────────────────── cash book ───────────────────────────────

export async function listFinanceEntries(limit = 500): Promise<FinanceEntry[]> {
  if (usingCloud && supabase) {
    const { data, error } = await supabase
      .from("finance_entries")
      .select("*")
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) fail("Could not load the cash book", error);
    return (data as FinanceRow[]).map(toFinanceEntry);
  }

  return [...readSnapshot().financeEntries]
    .sort((a, b) =>
      a.entryDate === b.entryDate
        ? b.createdAt.localeCompare(a.createdAt)
        : b.entryDate.localeCompare(a.entryDate),
    )
    .slice(0, limit);
}

export async function addFinanceEntry(input: FinanceEntryInput): Promise<FinanceEntry> {
  if (input.amount <= 0) throw new Error("Amount must be greater than zero");

  if (usingCloud && supabase) {
    const { data, error } = await supabase
      .from("finance_entries")
      .insert({
        entry_date: input.entryDate,
        kind: input.kind,
        description: input.description.trim(),
        category: input.category,
        amount: input.amount,
        method: input.method,
        source: "manual",
      })
      .select("*")
      .single();
    if (error) fail("Could not save the entry", error);
    return toFinanceEntry(data as FinanceRow);
  }

  return mutate((snapshot) => {
    const entry: FinanceEntry = {
      id: newId("fe"),
      entryDate: input.entryDate,
      kind: input.kind,
      description: input.description.trim(),
      category: input.category,
      amount: round2(input.amount),
      method: input.method,
      source: "manual",
      saleId: null,
      createdAt: new Date().toISOString(),
    };
    snapshot.financeEntries.unshift(entry);
    return entry;
  });
}

export async function deleteFinanceEntry(id: string): Promise<void> {
  if (usingCloud && supabase) {
    const { error } = await supabase.from("finance_entries").delete().eq("id", id);
    if (error) fail("Could not delete the entry", error);
    return;
  }

  mutate((snapshot) => {
    const index = snapshot.financeEntries.findIndex((entry) => entry.id === id);
    if (index >= 0) snapshot.financeEntries.splice(index, 1);
  });
}

// ──────────────────────────────── summary ─────────────────────────────────

/** Compute the summary locally so both backends agree on the numbers. */
export function summarise(
  stockItems: StockItem[],
  sales: Sale[],
  financeEntries: FinanceEntry[],
): ShopSummary {
  const live = sales.filter((sale) => sale.status === "confirmed");

  const revenue = round2(live.reduce((sum, sale) => sum + sale.subtotal - sale.discount, 0));
  const deliveryCharged = round2(live.reduce((sum, sale) => sum + sale.deliveryFee, 0));
  const billed = round2(live.reduce((sum, sale) => sum + sale.total, 0));
  const collected = round2(live.reduce((sum, sale) => sum + sale.paid, 0));
  const outstanding = round2(
    live.reduce((sum, sale) => sum + Math.max(sale.total - sale.paid, 0), 0),
  );
  const cogs = round2(
    live.reduce(
      (sum, sale) => sum + sale.items.reduce((line, item) => line + item.qty * item.unitCost, 0),
      0,
    ),
  );

  const cashIn = round2(
    financeEntries.filter((e) => e.kind === "income").reduce((sum, e) => sum + e.amount, 0),
  );
  const cashOut = round2(
    financeEntries.filter((e) => e.kind === "expense").reduce((sum, e) => sum + e.amount, 0),
  );
  const inventorySpend = round2(
    financeEntries
      .filter((e) => e.kind === "expense" && e.category === "Inventory")
      .reduce((sum, e) => sum + e.amount, 0),
  );
  // Inventory purchases are already accounted for through COGS, and refunds
  // belong to cancelled sales whose revenue is excluded — counting either here
  // would understate profit twice.
  const runningCosts = round2(
    financeEntries
      .filter((e) => e.kind === "expense" && isRunningCost(e.category))
      .reduce((sum, e) => sum + e.amount, 0),
  );

  const active = stockItems.filter((item) => !item.archived);
  const unitsLeft = active.reduce((sum, item) => sum + Math.max(stockLeft(item), 0), 0);
  const stockValue = round2(
    active.reduce((sum, item) => sum + Math.max(stockLeft(item), 0) * item.cost, 0),
  );
  const potentialSales = round2(
    active.reduce((sum, item) => sum + Math.max(stockLeft(item), 0) * item.price, 0),
  );
  const lowStockCount = active.filter((item) => stockLeft(item) <= item.lowStockAt).length;

  return {
    revenue,
    deliveryCharged,
    billed,
    collected,
    outstanding,
    cogs,
    grossProfit: round2(revenue - cogs),
    runningCosts,
    netProfit: round2(revenue - cogs - runningCosts),
    cashIn,
    cashOut,
    cashOnHand: round2(cashIn - cashOut),
    inventorySpend,
    unitsLeft,
    stockValue,
    potentialSales,
    lowStockCount,
  };
}

export interface ShopData {
  stockItems: StockItem[];
  sales: Sale[];
  financeEntries: FinanceEntry[];
  summary: ShopSummary;
}

/** One call for dashboard-style pages that need everything at once. */
export async function loadShopData(): Promise<ShopData> {
  const [stockItems, sales, financeEntries] = await Promise.all([
    listStockItems(true),
    listSales(1000),
    listFinanceEntries(2000),
  ]);
  return {
    stockItems,
    sales,
    financeEntries,
    summary: summarise(stockItems, sales, financeEntries),
  };
}

// ──────────────────────────── backup / restore ────────────────────────────

export async function exportBackup(): Promise<string> {
  const { stockItems, sales, financeEntries } = await loadShopData();
  return JSON.stringify(
    { exportedAt: new Date().toISOString(), stockItems, sales, financeEntries },
    null,
    2,
  );
}

/** Restore a JSON backup. Local backend only — cloud data is restored via Supabase. */
export function restoreLocalBackup(json: string): void {
  const parsed = JSON.parse(json) as Partial<PosSnapshot>;
  replaceSnapshot({
    version: 1,
    stockItems: parsed.stockItems ?? [],
    sales: parsed.sales ?? [],
    financeEntries: parsed.financeEntries ?? [],
    movements: parsed.movements ?? [],
  });
}

export function resetLocalData(): void {
  resetToSeed();
}

export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");
}

export function downloadFile(filename: string, content: string, type = "text/plain"): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
