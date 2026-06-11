import { createHmac } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { OrderItem } from "@/lib/orderStore";

type PayWayQrResponse = {
  qrString?: string;
  qrImage?: string;
  abapay_deeplink?: string;
  app_store?: string;
  play_store?: string;
  amount?: number;
  currency?: string;
  status?: {
    code?: string;
    message?: string;
    trace_id?: string;
  };
};

type PayWayCheckResponse = {
  data?: {
    payment_status_code?: number;
    payment_amount?: number;
    payment_currency?: string;
    payment_status?: string;
    transaction_date?: string;
    apv?: string;
  };
  status?: {
    code?: string;
    message?: string;
    tran_id?: string;
  };
};

type OrderRow = {
  id: string;
  total: number;
  currency: string;
  customer_name: string;
  phone: string;
  bakong_transaction_id: string | null;
  items: unknown;
};

const createQrSchema = z.object({
  orderId: z.string().uuid(),
  tranId: z.string().min(1).max(20),
});

const checkOrderSchema = z.object({
  orderId: z.string().uuid(),
  tranId: z.string().min(1).max(20),
});

function getEnv(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function getSupabaseUrl(): string {
  const value = getEnv("SUPABASE_URL") || getEnv("VITE_SUPABASE_URL");
  if (!value) throw new Error("Missing SUPABASE_URL or VITE_SUPABASE_URL");
  return value;
}

function getSupabaseServiceRoleKey(): string {
  const value = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!value) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return value;
}

function createServiceClient() {
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getPayWayConfig() {
  const merchantId = getEnv("PAYWAY_MERCHANT_ID");
  const apiKey = getEnv("PAYWAY_API_KEY");
  if (!merchantId || !apiKey) {
    throw new Error("Missing PAYWAY_MERCHANT_ID or PAYWAY_API_KEY");
  }

  return {
    merchantId,
    apiKey,
    baseUrl: (getEnv("PAYWAY_BASE_URL") || "https://checkout-sandbox.payway.com.kh").replace(
      /\/$/,
      "",
    ),
    paymentOption: getEnv("PAYWAY_PAYMENT_OPTION") || "abapay_khqr",
    qrImageTemplate: getEnv("PAYWAY_QR_IMAGE_TEMPLATE") || "template3_color",
    lifetime: Number(getEnv("PAYWAY_LIFETIME_MINUTES") || "30"),
  };
}

function utcRequestTime(): string {
  const now = new Date();
  const part = (value: number) => String(value).padStart(2, "0");
  return [
    now.getUTCFullYear(),
    part(now.getUTCMonth() + 1),
    part(now.getUTCDate()),
    part(now.getUTCHours()),
    part(now.getUTCMinutes()),
    part(now.getUTCSeconds()),
  ].join("");
}

function hmacSha512Base64(value: string, key: string): string {
  return createHmac("sha512", key).update(value).digest("base64");
}

function base64Json(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

function formatPayWayAmount(amount: number, currency: string): string {
  if (currency.toUpperCase() === "KHR") return String(Math.round(amount));
  return Number(amount.toFixed(2)).toString();
}

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: (parts[0] || "Customer").slice(0, 20),
    lastName: (parts.slice(1).join(" ") || "Hairora").slice(0, 20),
  };
}

function orderItemsForPayWay(items: unknown): Array<{ name: string; quantity: number; price: number }> {
  const parsed = Array.isArray(items) ? (items as OrderItem[]) : [];
  return parsed.slice(0, 10).map((item) => ({
    name: item.title.slice(0, 80),
    quantity: item.quantity,
    price: Number(item.price),
  }));
}

async function getOrder(orderId: string, tranId: string): Promise<OrderRow> {
  const { data: order, error } = await createServiceClient()
    .from("orders")
    .select("id,total,currency,customer_name,phone,bakong_transaction_id,items")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) throw new Error(error?.message || "Order not found");
  const row = order as OrderRow;
  if (row.bakong_transaction_id !== tranId) {
    throw new Error("Payment transaction does not match this order");
  }
  return row;
}

async function checkPayWayTransaction(tranId: string): Promise<PayWayCheckResponse> {
  const config = getPayWayConfig();
  const reqTime = utcRequestTime();
  const hash = hmacSha512Base64(`${reqTime}${config.merchantId}${tranId}`, config.apiKey);

  const response = await fetch(`${config.baseUrl}/api/payment-gateway/v1/payments/check-transaction-2`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      req_time: reqTime,
      merchant_id: config.merchantId,
      tran_id: tranId,
      hash,
    }),
  });

  const result = (await response.json().catch(() => null)) as PayWayCheckResponse | null;
  if (!response.ok || !result) {
    throw new Error("Unable to check ABA PayWay transaction");
  }
  return result;
}

export const createPayWayQr = createServerFn({ method: "POST" })
  .inputValidator(createQrSchema)
  .handler(async ({ data }) => {
    const order = await getOrder(data.orderId, data.tranId);
    const config = getPayWayConfig();
    const reqTime = utcRequestTime();
    const currency = order.currency.toUpperCase();
    const amount = formatPayWayAmount(Number(order.total), currency);
    const items = base64Json(orderItemsForPayWay(order.items));
    const { firstName, lastName } = splitName(order.customer_name);
    const callbackUrl = getEnv("PAYWAY_CALLBACK_URL")
      ? Buffer.from(getEnv("PAYWAY_CALLBACK_URL")!, "utf8").toString("base64")
      : "";
    const lifetime = Number.isFinite(config.lifetime) ? config.lifetime : 30;

    const hashSource =
      reqTime +
      config.merchantId +
      data.tranId +
      amount +
      items +
      firstName +
      lastName +
      "" +
      order.phone +
      "purchase" +
      config.paymentOption +
      callbackUrl +
      "" +
      currency +
      "" +
      "" +
      "" +
      lifetime +
      config.qrImageTemplate;

    const payload = {
      req_time: reqTime,
      merchant_id: config.merchantId,
      tran_id: data.tranId,
      first_name: firstName,
      last_name: lastName,
      email: "",
      phone: order.phone,
      amount: Number(amount),
      currency,
      purchase_type: "purchase",
      payment_option: config.paymentOption,
      items,
      callback_url: callbackUrl,
      return_deeplink: "",
      custom_fields: "",
      return_params: "",
      payout: "",
      lifetime,
      qr_image_template: config.qrImageTemplate,
      hash: hmacSha512Base64(hashSource, config.apiKey),
    };

    const response = await fetch(`${config.baseUrl}/api/payment-gateway/v1/payments/generate-qr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json().catch(() => null)) as PayWayQrResponse | null;

    if (!response.ok || !result) {
      throw new Error("Unable to generate ABA PayWay QR");
    }
    if (result.status?.code && result.status.code !== "0") {
      throw new Error(result.status.message || "ABA PayWay rejected this payment request");
    }

    return {
      tranId: data.tranId,
      qrString: result.qrString || "",
      qrImage: result.qrImage || "",
      deeplink: result.abapay_deeplink || "",
      appStore: result.app_store || "",
      playStore: result.play_store || "",
      amount: result.amount ?? Number(amount),
      currency: result.currency || currency,
    };
  });

export const confirmPayWayOrder = createServerFn({ method: "POST" })
  .inputValidator(checkOrderSchema)
  .handler(async ({ data }) => {
    const order = await getOrder(data.orderId, data.tranId);
    const result = await checkPayWayTransaction(data.tranId);
    const paymentStatus = result.data?.payment_status || "UNKNOWN";
    const paymentCurrency = result.data?.payment_currency?.toUpperCase();
    const paymentAmount = Number(result.data?.payment_amount ?? 0);
    const expectedAmount = Number(order.total);
    const isApproved = result.status?.code === "00" && result.data?.payment_status_code === 0;
    const amountMatches = paymentAmount + 0.00001 >= expectedAmount;
    const currencyMatches = !paymentCurrency || paymentCurrency === order.currency.toUpperCase();

    if (isApproved && amountMatches && currencyMatches) {
      const { error } = await createServiceClient()
        .from("orders")
        .update({ status: "paid" })
        .eq("id", order.id)
        .eq("bakong_transaction_id", data.tranId);
      if (error) throw new Error(error.message);
      return { paid: true, status: paymentStatus, message: "Payment received" };
    }

    return {
      paid: false,
      status: paymentStatus,
      message: result.status?.message || "Payment is not approved yet",
    };
  });
