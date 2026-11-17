// Server-only: KHQR payment attempts for an order (create QR, check, confirm).
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  checkTransaction,
  generateQr,
  getTransactionDetails,
  isPayWayConfigured,
  newTranId,
} from "./payway";
import { writeWithActor } from "./audit";
import { getOrder, markOrderPaidByKhqr, orderRef, type OrderRecord } from "./orderLifecycle";
import { notifyAdmins } from "./notify";
import { escapeHtml } from "./telegram";

type PaymentRow = {
  id: string;
  order_id: string;
  tran_id: string;
  amount: number;
  currency: string;
  status: string;
  qr_string: string | null;
  deeplink: string | null;
  expires_at: string | null;
  created_at: string;
};

export type PaymentState = "paid" | "pending" | "expired" | "cancelled" | "closed";

export type KhqrSession = {
  state: PaymentState;
  orderId: string;
  reference: string;
  amount: number;
  currency: string;
  tranId: string | null;
  qrString: string | null;
  deeplink: string | null;
  expiresAt: string | null;
};

const EXPIRY_GRACE_MS = 30_000;

function stateForOrder(order: OrderRecord): PaymentState | null {
  if (order.status === "paid" || order.status === "shipped" || order.status === "done") return "paid";
  if (order.status === "cancelled") return "cancelled";
  return null;
}

function session(order: OrderRecord, state: PaymentState, payment?: PaymentRow | null): KhqrSession {
  return {
    state,
    orderId: order.id,
    reference: orderRef(order),
    amount: Number(order.total),
    currency: order.currency,
    tranId: payment?.tran_id ?? null,
    qrString: state === "pending" ? (payment?.qr_string ?? null) : null,
    deeplink: state === "pending" ? (payment?.deeplink ?? null) : null,
    expiresAt: payment?.expires_at ?? null,
  };
}

async function pendingPayments(supabase: SupabaseClient, orderId: string): Promise<PaymentRow[]> {
  const { data, error } = await supabase
    .from("payments")
    .select("id,order_id,tran_id,amount,currency,status,qr_string,deeplink,expires_at,created_at")
    .eq("order_id", orderId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as PaymentRow[];
}

const isExpired = (payment: PaymentRow, graceMs = 0) =>
  !!payment.expires_at && new Date(payment.expires_at).getTime() + graceMs < Date.now();

/**
 * Ask ABA about every open QR for this order. Marks the order paid when one
 * was approved for the full amount; marks expired QRs as expired.
 */
export async function refreshKhqrPayment(
  supabase: SupabaseClient,
  orderId: string,
): Promise<KhqrSession> {
  let order = await getOrder(supabase, orderId);
  const fixed = stateForOrder(order);
  if (fixed === "paid") return session(order, "paid");
  if (order.payment_method !== "khqr") return session(order, fixed ?? "closed");

  const payments = await pendingPayments(supabase, orderId);
  for (const payment of payments) {
    const result = await checkTransaction(payment.tran_id);
    const approved = result.found && result.statusCode === 0;
    const amountOk = result.paidAmount + 0.00001 >= Number(order.total);
    const currencyOk = !result.paidCurrency || result.paidCurrency === order.currency.toUpperCase();

    if (approved && amountOk && currencyOk) {
      const details = await getTransactionDetails(payment.tran_id);
      await markOrderPaidByKhqr(supabase, order.id, {
        tranId: payment.tran_id,
        apv: result.apv,
        paidAmount: result.paidAmount,
        paidCurrency: result.paidCurrency || order.currency,
        bankName: details?.bankName,
        payerAccount: details?.payerAccount,
        paymentType: details?.paymentType,
        raw: result.raw,
      });
      order = await getOrder(supabase, orderId);
      return session(order, "paid");
    }

    if (approved && !(amountOk && currencyOk)) {
      // Paid, but not the full amount — leave it for the shop to sort out.
      await supabase
        .from("payments")
        .update({ status: "declined", paid_amount: result.paidAmount, paid_currency: result.paidCurrency, raw: result.raw as object, updated_at: new Date().toISOString() })
        .eq("id", payment.id);
      await notifyAdmins(supabase, {
        type: "payment_issue",
        title: `Wrong amount paid · ${orderRef(order)}`,
        message: `Customer paid ${result.paidAmount} ${result.paidCurrency}, order total is ${order.total} ${order.currency}.`,
        data: { orderId: order.id, link: "/admin/orders" },
        telegram: {
          html: `❗ <b>Wrong amount paid</b>\nOrder ${escapeHtml(orderRef(order))}: paid ${result.paidAmount} ${escapeHtml(result.paidCurrency)}, expected ${order.total} ${escapeHtml(order.currency)}. Contact ${escapeHtml(order.customer_name)} (${escapeHtml(order.phone)}).`,
        },
      });
      continue;
    }

    const closed = result.statusCode === 3 || result.statusCode === 7;
    if (closed || isExpired(payment, EXPIRY_GRACE_MS)) {
      await supabase
        .from("payments")
        .update({ status: closed ? "cancelled" : "expired", updated_at: new Date().toISOString() })
        .eq("id", payment.id);
    }
  }

  if (fixed === "cancelled") return session(order, "cancelled");
  const open = (await pendingPayments(supabase, orderId)).find((p) => !isExpired(p));
  return open ? session(order, "pending", open) : session(order, "expired");
}

/**
 * Return the open KHQR for this order, or create a new one. Before creating
 * a new QR, the old ones are checked so a customer is never asked to pay twice.
 */
export async function startKhqrPayment(
  supabase: SupabaseClient,
  orderId: string,
): Promise<KhqrSession> {
  const current = await refreshKhqrPayment(supabase, orderId);
  if (current.state !== "expired" && !(current.state === "pending" && !current.qrString)) {
    return current;
  }

  const order = await getOrder(supabase, orderId);
  if (order.status !== "pending" || order.payment_method !== "khqr") return current;

  const tranId = newTranId();
  const qr = await generateQr({
    tranId,
    amount: Number(order.total),
    currency: order.currency,
    customerName: order.customer_name,
    phone: order.phone,
    items: (order.items ?? []).map((item) => ({
      name: item.title ?? "Item",
      quantity: Number(item.quantity ?? 1),
      price: Number(item.price ?? 0),
    })),
  });

  const { data: payment, error } = await supabase
    .from("payments")
    .insert({
      order_id: order.id,
      provider: "payway",
      tran_id: tranId,
      amount: Number(order.total),
      currency: order.currency,
      status: "pending",
      qr_string: qr.qrString || null,
      deeplink: qr.deeplink || null,
      expires_at: qr.expiresAt,
    })
    .select("id,order_id,tran_id,amount,currency,status,qr_string,deeplink,expires_at,created_at")
    .single();
  if (error) throw new Error(error.message);

  await supabase
    .from("orders")
    .update({ bakong_transaction_id: tranId, payment_expires_at: qr.expiresAt })
    .eq("id", order.id);

  return session(order, "pending", payment as PaymentRow);
}

/** Find the order for a PayWay tran_id (used by the ABA callback). */
export async function orderIdForTranId(
  supabase: SupabaseClient,
  tranId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("payments")
    .select("order_id")
    .eq("tran_id", tranId)
    .maybeSingle();
  return (data?.order_id as string | undefined) ?? null;
}

/**
 * Cancel KHQR orders nobody paid for (QR expired more than an hour ago).
 * Each one is checked with ABA first, so a late payment is never lost.
 * Used by Admin → Orders and the nightly job.
 */
export async function cancelExpiredKhqrOrders(
  supabase: SupabaseClient,
  actor = "Auto-cancel (QR expired)",
): Promise<{ cancelled: number; paid: number }> {
  if (!isPayWayConfigured()) return { cancelled: 0, paid: 0 };
  const cutoff = new Date(Date.now() - 60 * 60_000).toISOString();
  const { data: rows, error } = await supabase
    .from("orders")
    .select("id")
    .eq("status", "pending")
    .eq("payment_method", "khqr")
    .lt("payment_expires_at", cutoff)
    .limit(20);
  if (error) throw new Error(error.message);

  let cancelled = 0;
  let paid = 0;
  for (const { id } of (rows ?? []) as Array<{ id: string }>) {
    try {
      const state = await refreshKhqrPayment(supabase, id);
      if (state.state === "paid") {
        paid++;
      } else if (state.state === "expired") {
        await writeWithActor(
          (row) => supabase.from("orders").update(row).eq("id", id).eq("status", "pending"),
          { status: "cancelled" },
          actor,
        );
        cancelled++;
      }
    } catch (err) {
      console.error("[cancelExpiredKhqrOrders]", id, err);
    }
  }
  return { cancelled, paid };
}
