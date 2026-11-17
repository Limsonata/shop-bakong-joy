// Order data layer. Persists orders to Supabase.
import { supabase, type DbOrder, type DbPayment } from "./supabase";
import { getCurrentUser } from "./auth";
import { getSupabaseAccessToken } from "./authToken";
import {
  cancelUnpaidKhqrOrders,
  createSecureOrder,
  retryAdminOrderPosSync,
  updateAdminOrderStatus,
} from "./api/security.functions";

export type OrderStatus = "pending" | "paid" | "shipped" | "done" | "cancelled";
export type PaymentMethod = "khqr" | "aba_manual" | "cod";

export interface OrderItem {
  productId: string;
  variantId?: string | null;
  title: string;
  quantity: number;
  price: number;
  currency: string;
  imageUrl?: string;
}

export interface OrderPayment {
  tranId: string;
  status: DbPayment["status"];
  amount: number;
  currency: string;
  apv: string | null;
  bankName: string | null;
  payerAccount: string | null;
  paymentType: string | null;
  paidAt: number | null;
  createdAt: number;
}

export interface Order {
  id: string;
  userId: string | null;
  customerName: string;
  phone: string;
  address: string;
  total: number;
  currency: string;
  bakongReference: string | null;
  bakongTransactionId: string | null;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paidAt: number | null;
  paymentExpiresAt: number | null;
  /** Only loaded for admins. */
  payments: OrderPayment[];
  items: OrderItem[];
  createdAt: number;
}

export interface CreateOrderInput {
  customerName: string;
  phone: string;
  address: string;
  paymentMethod: PaymentMethod;
  items: OrderItem[];
}

const time = (value: string | null | undefined) => (value ? new Date(value).getTime() : null);

export function dbOrderToOrder(row: DbOrder): Order {
  return {
    id: row.id,
    userId: row.user_id,
    customerName: row.customer_name,
    phone: row.phone,
    address: row.address,
    total: Number(row.total),
    currency: row.currency,
    bakongReference: row.bakong_reference,
    bakongTransactionId: row.bakong_transaction_id,
    status: row.status,
    paymentMethod: row.payment_method ?? "cod",
    paidAt: time(row.paid_at),
    paymentExpiresAt: time(row.payment_expires_at),
    payments: (row.payments ?? [])
      .map((p) => ({
        tranId: p.tran_id,
        status: p.status,
        amount: Number(p.paid_amount ?? p.amount),
        currency: p.paid_currency || p.currency,
        apv: p.apv,
        bankName: p.bank_name,
        payerAccount: p.payer_account,
        paymentType: p.payment_type,
        paidAt: time(p.paid_at),
        createdAt: new Date(p.created_at).getTime(),
      }))
      .sort((a, b) => b.createdAt - a.createdAt),
    items: (row.items as OrderItem[]) ?? [],
    createdAt: new Date(row.created_at).getTime(),
  };
}

/** Customer-facing order number. */
export function orderNumber(order: Pick<Order, "id" | "bakongReference">): string {
  return order.bakongReference || order.id.slice(0, 8).toUpperCase();
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  if (!supabase) throw new Error("Supabase is not configured");

  // The server prices the items, checks stock, creates the order and sends
  // the shop + customer notifications (INSERT is revoked for browsers).
  const accessToken = await getSupabaseAccessToken();
  const data = await createSecureOrder({
    data: {
      accessToken,
      customerName: input.customerName,
      phone: input.phone,
      address: input.address,
      paymentMethod: input.paymentMethod,
      items: input.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      })),
    },
  });

  return dbOrderToOrder(data as unknown as DbOrder);
}

export async function getMyOrders(): Promise<Order[]> {
  if (!supabase) throw new Error("Supabase is not configured");

  const user = await getCurrentUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`Failed to load your orders: ${error.message}`);
  }
  return (data ?? []).map((row) => dbOrderToOrder(row as DbOrder));
}

export async function getAllOrders(): Promise<Order[]> {
  if (!supabase) throw new Error("Supabase is not configured");

  const withPayments = await supabase
    .from("orders")
    .select(
      "*, payments(id,tran_id,amount,currency,status,apv,bank_name,payer_account,payment_type,paid_amount,paid_currency,paid_at,created_at)",
    )
    .order("created_at", { ascending: false })
    .limit(500);
  // Before the payments migration runs, fall back to orders only.
  const { data, error } = withPayments.error
    ? await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(500)
    : withPayments;
  if (error) throw new Error(`Failed to load orders: ${error.message}`);
  return (data ?? []).map((row) => dbOrderToOrder(row as DbOrder));
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured");

  const accessToken = await getSupabaseAccessToken();
  try {
    await updateAdminOrderStatus({ data: { accessToken, id, status } });
  } catch (error) {
    // Surface the real reason (missing SUPABASE_SERVICE_ROLE_KEY, not an
    // admin, DB error, …) instead of swallowing it into a generic failure.
    console.error("[orderStore] Failed to update order status:", error);
    throw error instanceof Error ? error : new Error("Failed to update order status");
  }
}

/** Admin housekeeping: cancel KHQR orders whose QR expired over an hour ago. */
export async function cancelUnpaidOrders(): Promise<{ cancelled: number; paid: number }> {
  const accessToken = await getSupabaseAccessToken();
  return cancelUnpaidKhqrOrders({ data: { accessToken } });
}

// ── POS sync state ───────────────────────────────────────────

export type PosSyncProblem =
  /** Order is paid / shipped / delivered but no POS sale exists: stock and cash not recorded. */
  | "missing_sale"
  /** Order is cancelled but its POS sale is still confirmed: stock not returned, no refund posted. */
  | "not_cancelled"
  /** Sale exists but its delivery status lags behind the order. */
  | "delivery_behind";

export interface OrderPosState {
  saleId: string | null;
  saleCode: string | null;
  problem: PosSyncProblem | null;
  /** Item titles that were sold without a stock row (stock did not move). */
  unmatchedItems: string[];
}

type OrderSaleRow = {
  id: string;
  code: string;
  order_id: string;
  status: "confirmed" | "cancelled";
  delivery_status: "preparing" | "sent" | "delivered" | "returned";
  sale_items: Array<{ stock_item_id: string | null; name: string }> | null;
};

/** The POS side of each order, worked out from the sales table (no extra columns needed). */
export async function getOrderPosStates(orders: Order[]): Promise<Map<string, OrderPosState>> {
  const states = new Map<string, OrderPosState>();
  if (!supabase || orders.length === 0) return states;

  const { data, error } = await supabase
    .from("sales")
    .select("id, code, order_id, status, delivery_status, sale_items(stock_item_id, name)")
    .not("order_id", "is", null)
    .limit(2000);
  if (error) throw new Error(`Failed to load POS sales: ${error.message}`);
  const byOrder = new Map(((data ?? []) as OrderSaleRow[]).map((row) => [row.order_id, row]));

  for (const order of orders) {
    const sale = byOrder.get(order.id);
    let problem: PosSyncProblem | null = null;
    if (order.status === "paid" || order.status === "shipped" || order.status === "done") {
      // Cash-on-delivery orders only become a sale once delivered and paid.
      const saleExpected = order.status !== "shipped" || order.paymentMethod !== "cod";
      if (!sale) problem = saleExpected ? "missing_sale" : null;
      else if (sale.status === "confirmed") {
        const behind =
          (order.status === "shipped" && sale.delivery_status === "preparing") ||
          (order.status === "done" && sale.delivery_status !== "delivered");
        if (behind) problem = "delivery_behind";
      }
    } else if (order.status === "cancelled" && sale?.status === "confirmed") {
      problem = "not_cancelled";
    }
    states.set(order.id, {
      saleId: sale?.id ?? null,
      saleCode: sale?.code ?? null,
      problem,
      unmatchedItems: (sale?.sale_items ?? [])
        .filter((item) => !item.stock_item_id)
        .map((item) => item.name),
    });
  }
  return states;
}

/** Re-run the POS sync for one order (admin only). */
export async function retryOrderPosSync(id: string): Promise<void> {
  const accessToken = await getSupabaseAccessToken();
  await retryAdminOrderPosSync({ data: { accessToken, id } });
}
