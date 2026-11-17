// Server-only ABA PayWay client (KHQR). Docs: QR API (generate-qr),
// Check Transaction (check-transaction-2), Get Transaction Details.
import { createHmac, randomBytes } from "node:crypto";
import { getEnv } from "./supabaseAdmin";

export type PayWayConfig = {
  merchantId: string;
  apiKey: string;
  baseUrl: string;
  paymentOption: string;
  qrImageTemplate: string;
  lifetimeMinutes: number;
  callbackUrl: string | null;
};

export function isPayWayConfigured(): boolean {
  return Boolean(getEnv("PAYWAY_MERCHANT_ID") && getEnv("PAYWAY_API_KEY"));
}

export function getPayWayConfig(): PayWayConfig {
  const merchantId = getEnv("PAYWAY_MERCHANT_ID");
  const apiKey = getEnv("PAYWAY_API_KEY");
  if (!merchantId || !apiKey) throw new Error("KHQR payment is not set up yet");
  const lifetime = Number(getEnv("PAYWAY_LIFETIME_MINUTES") || "15");
  return {
    merchantId,
    apiKey,
    baseUrl: (getEnv("PAYWAY_BASE_URL") || "https://checkout-sandbox.payway.com.kh").replace(/\/$/, ""),
    paymentOption: getEnv("PAYWAY_PAYMENT_OPTION") || "abapay_khqr",
    qrImageTemplate: getEnv("PAYWAY_QR_IMAGE_TEMPLATE") || "template3_color",
    // ABA minimum is 3 minutes.
    lifetimeMinutes: Number.isFinite(lifetime) ? Math.min(Math.max(Math.round(lifetime), 3), 1440) : 15,
    callbackUrl: callbackUrl(),
  };
}

/** Public URL ABA posts to when a payment completes. */
function callbackUrl(): string | null {
  const explicit = getEnv("PAYWAY_CALLBACK_URL");
  const base = getEnv("APP_URL") || getEnv("VITE_APP_URL");
  const url = explicit || (base ? `${base.replace(/\/$/, "")}/api/payway/callback` : null);
  if (!url) return null;
  const secret = getEnv("PAYWAY_CALLBACK_SECRET");
  if (!secret || url.includes("key=")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}key=${encodeURIComponent(secret)}`;
}

function utcRequestTime(): string {
  const now = new Date();
  const p = (value: number) => String(value).padStart(2, "0");
  return `${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}${p(
    now.getUTCHours(),
  )}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}`;
}

function sign(value: string, key: string): string {
  return createHmac("sha512", key).update(value).digest("base64");
}

const b64 = (value: string) => Buffer.from(value, "utf8").toString("base64");

export function formatPayWayAmount(amount: number, currency: string): string {
  return currency.toUpperCase() === "KHR" ? String(Math.round(amount)) : Number(amount).toFixed(2);
}

/** Unique PayWay tran_id (max 20 chars): BG + base36 time + random. */
export function newTranId(): string {
  const time = Date.now().toString(36).toUpperCase();
  const rand = randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
  return `BG${time}${rand}`.slice(0, 20);
}

/** ABA rejects names with digits or symbols. */
function cleanName(value: string, fallback: string): string {
  const cleaned = value.replace(/[^\p{L}\s]/gu, " ").replace(/\s+/g, " ").trim();
  return (cleaned || fallback).slice(0, 20);
}

function cleanPhone(value: string): string {
  return value.replace(/[^\d+]/g, "").slice(0, 20);
}

export type GenerateQrInput = {
  tranId: string;
  amount: number;
  currency: string;
  customerName: string;
  phone: string;
  items: Array<{ name: string; quantity: number; price: number }>;
};

export type GenerateQrResult = {
  qrString: string;
  qrImage: string;
  deeplink: string;
  appStore: string;
  playStore: string;
  amount: number;
  currency: string;
  expiresAt: string;
};

export async function generateQr(input: GenerateQrInput): Promise<GenerateQrResult> {
  const config = getPayWayConfig();
  const reqTime = utcRequestTime();
  const currency = input.currency.toUpperCase();
  const amount = formatPayWayAmount(input.amount, currency);
  const parts = input.customerName.trim().split(/\s+/);
  const firstName = cleanName(parts[0] ?? "", "Customer");
  const lastName = cleanName(parts.slice(1).join(" "), "BillieGrace");
  const phone = cleanPhone(input.phone);
  const items = b64(
    JSON.stringify(
      input.items.slice(0, 10).map((item) => ({
        name: item.name.slice(0, 80),
        quantity: item.quantity,
        price: Number(Number(item.price).toFixed(2)),
      })),
    ),
  );
  const callback = config.callbackUrl ? b64(config.callbackUrl) : "";
  const email = "";
  const purchaseType = "purchase";
  const returnDeeplink = "";
  const customFields = "";
  const returnParams = "";
  const payout = "";

  // Hash field order is fixed by ABA (differs from the parameter table).
  const hash = sign(
    reqTime +
      config.merchantId +
      input.tranId +
      amount +
      items +
      firstName +
      lastName +
      email +
      phone +
      purchaseType +
      config.paymentOption +
      callback +
      returnDeeplink +
      currency +
      customFields +
      returnParams +
      payout +
      config.lifetimeMinutes +
      config.qrImageTemplate,
    config.apiKey,
  );

  const response = await fetch(`${config.baseUrl}/api/payment-gateway/v1/payments/generate-qr`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      req_time: reqTime,
      merchant_id: config.merchantId,
      tran_id: input.tranId,
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      amount,
      currency,
      purchase_type: purchaseType,
      payment_option: config.paymentOption,
      items,
      callback_url: callback,
      return_deeplink: returnDeeplink,
      custom_fields: customFields,
      return_params: returnParams,
      payout,
      lifetime: config.lifetimeMinutes,
      qr_image_template: config.qrImageTemplate,
      hash,
    }),
  });

  type QrResponse = {
    qrString?: string;
    qrImage?: string;
    abapay_deeplink?: string;
    app_store?: string;
    play_store?: string;
    amount?: number;
    currency?: string;
    status?: { code?: string | number; message?: string };
  };
  const result = (await response.json().catch(() => null)) as QrResponse | null;
  if (!response.ok || !result) {
    console.error("[PayWay] generate-qr HTTP", response.status);
    throw new Error("ABA PayWay is not responding. Please try again.");
  }
  if (result.status?.code !== undefined && String(result.status.code) !== "0") {
    console.error("[PayWay] generate-qr rejected:", result.status);
    throw new Error(`ABA PayWay: ${result.status.message || "payment request rejected"}`);
  }
  if (!result.qrString && !result.qrImage) throw new Error("ABA PayWay did not return a QR code");

  return {
    qrString: result.qrString ?? "",
    qrImage: result.qrImage ?? "",
    deeplink: result.abapay_deeplink ?? "",
    appStore: result.app_store ?? "",
    playStore: result.play_store ?? "",
    amount: Number(result.amount ?? amount),
    currency: result.currency ?? currency,
    expiresAt: new Date(Date.now() + config.lifetimeMinutes * 60_000).toISOString(),
  };
}

export type TransactionStatus = {
  found: boolean;
  /** 0 approved, 2 pending, 3 declined, 4 refunded, 7 cancelled */
  statusCode: number | null;
  status: string;
  paidAmount: number;
  paidCurrency: string;
  totalAmount: number;
  apv: string;
  raw: unknown;
};

export async function checkTransaction(tranId: string): Promise<TransactionStatus> {
  const config = getPayWayConfig();
  const reqTime = utcRequestTime();
  const response = await fetch(
    `${config.baseUrl}/api/payment-gateway/v1/payments/check-transaction-2`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        req_time: reqTime,
        merchant_id: config.merchantId,
        tran_id: tranId,
        hash: sign(reqTime + config.merchantId + tranId, config.apiKey),
      }),
    },
  );
  type CheckResponse = {
    data?: {
      payment_status_code?: number;
      payment_status?: string;
      payment_amount?: number;
      payment_currency?: string;
      total_amount?: number;
      apv?: string;
    };
    status?: { code?: string | number; message?: string };
  };
  const result = (await response.json().catch(() => null)) as CheckResponse | null;
  if (!response.ok || !result) throw new Error("Unable to check the payment with ABA PayWay");

  const code = String(result.status?.code ?? "");
  if (code === "6") {
    return { found: false, statusCode: null, status: "NOT_FOUND", paidAmount: 0, paidCurrency: "", totalAmount: 0, apv: "", raw: result };
  }
  if (code !== "00") {
    throw new Error(`ABA PayWay check failed: ${result.status?.message ?? code}`);
  }
  return {
    found: true,
    statusCode: typeof result.data?.payment_status_code === "number" ? result.data.payment_status_code : null,
    status: result.data?.payment_status ?? "UNKNOWN",
    paidAmount: Number(result.data?.payment_amount ?? 0),
    paidCurrency: (result.data?.payment_currency ?? "").toUpperCase(),
    totalAmount: Number(result.data?.total_amount ?? 0),
    apv: result.data?.apv ?? "",
    raw: result,
  };
}

export type TransactionDetails = {
  bankName: string | null;
  payerAccount: string | null;
  paymentType: string | null;
  payerName: string | null;
};

/** Payer bank / account. Rate-limited by ABA (10/min) — best-effort only. */
export async function getTransactionDetails(tranId: string): Promise<TransactionDetails | null> {
  try {
    const config = getPayWayConfig();
    const reqTime = utcRequestTime();
    const response = await fetch(
      `${config.baseUrl}/api/payment-gateway/v1/payments/transaction-detail`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          req_time: reqTime,
          merchant_id: config.merchantId,
          tran_id: tranId,
          hash: sign(reqTime + config.merchantId + tranId, config.apiKey),
        }),
      },
    );
    type DetailResponse = {
      data?: {
        bank_name?: string;
        payer_account?: string;
        payment_type?: string;
        first_name?: string;
        last_name?: string;
      };
      status?: { code?: string | number };
    };
    const result = (await response.json().catch(() => null)) as DetailResponse | null;
    if (!response.ok || !result || String(result.status?.code) !== "00" || !result.data) return null;
    const payerName = [result.data.first_name, result.data.last_name].filter(Boolean).join(" ");
    return {
      bankName: result.data.bank_name || null,
      payerAccount: result.data.payer_account || null,
      paymentType: result.data.payment_type || null,
      payerName: payerName || null,
    };
  } catch (error) {
    console.error("[PayWay] transaction-detail failed:", error);
    return null;
  }
}
