// Single source of truth for order status labels and badge colors.
// Used by: /orders (customer), /track (customer), /admin/orders (admin).
import type { OrderStatus, PaymentMethod } from "./orderStore";

export const ORDER_STATUS: Record<OrderStatus, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  paid: { label: "Payment received", color: "bg-blue-100 text-blue-800" },
  shipped: { label: "Shipped", color: "bg-purple-100 text-purple-800" },
  done: { label: "Completed", color: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-700" },
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  khqr: "KHQR (any bank)",
  aba_manual: "ABA QR (manual)",
  cod: "Cash on delivery",
};

/** Status label that also says what happens next for pending orders. */
export function statusFor(order: { status: OrderStatus; paymentMethod: PaymentMethod }): {
  label: string;
  color: string;
} {
  if (order.status !== "pending") return ORDER_STATUS[order.status];
  if (order.paymentMethod === "khqr") {
    return { label: "Waiting for payment", color: "bg-yellow-100 text-yellow-800" };
  }
  if (order.paymentMethod === "aba_manual") {
    return { label: "Checking payment", color: "bg-yellow-100 text-yellow-800" };
  }
  return { label: "Confirmed · pay on delivery", color: "bg-sky-100 text-sky-800" };
}

/** Statuses where the money is actually in (used by finance/reporting). */
export const COLLECTED_STATUSES: OrderStatus[] = ["paid", "shipped", "done"];

export function isCollected(status: OrderStatus): boolean {
  return COLLECTED_STATUSES.includes(status);
}
