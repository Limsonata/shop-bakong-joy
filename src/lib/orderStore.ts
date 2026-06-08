// Order data layer. Persists orders to Supabase when configured,
// otherwise saves to localStorage so the demo flow still feels real.
import { supabase, isSupabaseConfigured, type DbOrder } from "./supabase";
import { getCurrentUser } from "./auth";

export type OrderStatus = "pending" | "paid" | "shipped" | "done" | "cancelled";

export interface OrderItem {
  productId: string;
  title: string;
  quantity: number;
  price: number;
  currency: string;
  imageUrl?: string;
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
  items: OrderItem[];
  createdAt: number;
}

export interface CreateOrderInput {
  customerName: string;
  phone: string;
  address: string;
  total: number;
  currency: string;
  bakongReference: string;
  bakongTransactionId: string;
  items: OrderItem[];
}

const ORDERS_STORAGE_KEY = "local-orders";
const isBrowser = typeof window !== "undefined";

function dbOrderToOrder(row: DbOrder): Order {
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
    items: (row.items as OrderItem[]) ?? [],
    createdAt: new Date(row.created_at).getTime(),
  };
}

function getLocalOrders(): Order[] {
  if (!isBrowser) return [];
  const stored = localStorage.getItem(ORDERS_STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

function saveLocalOrders(orders: Order[]): void {
  if (!isBrowser) return;
  localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  if (isSupabaseConfigured && supabase) {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from("orders")
      .insert({
        user_id: user?.id ?? null,
        customer_name: input.customerName,
        phone: input.phone,
        address: input.address,
        total: input.total,
        currency: input.currency,
        bakong_reference: input.bakongReference,
        bakong_transaction_id: input.bakongTransactionId,
        status: "pending",
        items: input.items,
      })
      .select("*")
      .single();
    if (error || !data) {
      console.error("[orderStore] Supabase insert failed:", error);
      throw new Error(error?.message || "Failed to create order");
    }
    console.log("[orderStore] Order saved to Supabase:", data.id);
    return dbOrderToOrder(data as DbOrder);
  }

  // Demo mode: localStorage
  const user = await getCurrentUser();
  const order: Order = {
    id: `order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId: user?.id ?? null,
    customerName: input.customerName,
    phone: input.phone,
    address: input.address,
    total: input.total,
    currency: input.currency,
    bakongReference: input.bakongReference,
    bakongTransactionId: input.bakongTransactionId,
    status: "pending",
    items: input.items,
    createdAt: Date.now(),
  };
  const orders = getLocalOrders();
  orders.unshift(order);
  saveLocalOrders(orders);
  console.log("[orderStore] Order saved to localStorage:", order.id, "for user:", user?.id ?? "(guest)");
  console.log("[orderStore] Total orders in storage now:", orders.length);
  return order;
}

export async function getMyOrders(): Promise<Order[]> {
  if (isSupabaseConfigured && supabase) {
    const user = await getCurrentUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error || !data) {
      console.error("[orderStore] Supabase getMyOrders failed:", error);
      return [];
    }
    return data.map((row) => dbOrderToOrder(row as DbOrder));
  }

  // Demo mode: show orders for the current user OR guest orders (userId null).
  // This mirrors a typical store experience where guest orders are claimed
  // by the customer once they log in with the same browser.
  const user = await getCurrentUser();
  const all = getLocalOrders();
  const mine = user
    ? all.filter((o) => o.userId === user.id || o.userId === null)
    : all.filter((o) => o.userId === null);
  console.log(
    `[orderStore] getMyOrders: ${mine.length} of ${all.length} for user ${user?.id ?? "(guest)"}`,
  );
  return mine;
}

export async function getAllOrders(): Promise<Order[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return data.map((row) => dbOrderToOrder(row as DbOrder));
  }

  return getLocalOrders();
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    return !error;
  }

  const orders = getLocalOrders();
  const order = orders.find((o) => o.id === id);
  if (!order) return false;
  order.status = status;
  saveLocalOrders(orders);
  return true;
}
