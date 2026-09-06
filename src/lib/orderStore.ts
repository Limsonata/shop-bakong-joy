// Order data layer. Persists orders to Supabase.
import { supabase, type DbOrder } from "./supabase";
import { getCurrentUser } from "./auth";
import { getSupabaseAccessToken } from "./authToken";
import { createSecureOrder, updateAdminOrderStatus } from "./api/security.functions";

export type OrderStatus = "pending" | "paid" | "shipped" | "done" | "cancelled";

export interface OrderItem {
  productId: string;
  variantId?: string | null;
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

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  if (!supabase) throw new Error("Supabase is not configured");

  // Use the server function (service_role) — INSERT is revoked from the
  // authenticated role on the orders table, so a direct client insert would fail.
  const accessToken = await getSupabaseAccessToken();
  const data = await createSecureOrder({
    data: {
      accessToken,
      customerName: input.customerName,
      phone: input.phone,
      address: input.address,
      bakongReference: input.bakongReference || undefined,
      bakongTransactionId: input.bakongTransactionId,
      items: input.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      })),
    },
  });

  // Notify the user (best-effort — ignore errors)
  const userId = (data as DbOrder).user_id;
  if (userId) {
    const payMethod = "Pay on delivery";
    void Promise.resolve(
      supabase.from("notifications").insert({
        user_id: userId,
        type: "order_update",
        title: "Order placed!",
        message: `Your order of ${input.currency} ${input.total.toFixed(2)} (${payMethod}) has been placed and is being prepared.`,
        data: { orderId: (data as DbOrder).id },
        read: false,
      }),
    ).catch(() => {});
  }

  return dbOrderToOrder(data as DbOrder);
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

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load orders: ${error.message}`);
  return (data ?? []).map((row) => dbOrderToOrder(row as DbOrder));
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<boolean> {
  if (!supabase) throw new Error("Supabase is not configured");

  try {
    const accessToken = await getSupabaseAccessToken();
    await updateAdminOrderStatus({ data: { accessToken, id, status } });
    return true;
  } catch {
    return false;
  }
}
