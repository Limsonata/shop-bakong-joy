import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { createServiceClient } from "@/lib/server/supabaseAdmin";
import { isPayWayConfigured } from "@/lib/server/payway";
import { refreshKhqrPayment, startKhqrPayment } from "@/lib/server/payments";

export type { KhqrSession, PaymentState } from "@/lib/server/payments";

// The order id (a random UUID returned only to the buyer) is the capability
// for these calls, so guests can pay too. Payment status always comes from ABA.
const orderSchema = z.object({ orderId: z.string().uuid() });

/** Which payment methods the checkout can offer right now. */
export const getPaymentOptions = createServerFn({ method: "GET" }).handler(async () => ({
  khqr: isPayWayConfigured(),
}));

/** Show the open KHQR for an order, or create a fresh one if it expired. */
export const startOrderPayment = createServerFn({ method: "POST" })
  .inputValidator(orderSchema)
  .handler(async ({ data }) => startKhqrPayment(createServiceClient(), data.orderId));

/** Poll ABA for the order's payment. Marks the order paid when the money arrived. */
export const checkOrderPayment = createServerFn({ method: "POST" })
  .inputValidator(orderSchema)
  .handler(async ({ data }) => refreshKhqrPayment(createServiceClient(), data.orderId));

/** KHQR setup status for Admin → Settings (no secrets returned). */
export const getPaymentSetup = createServerFn({ method: "POST" })
  .inputValidator(z.object({ accessToken: z.string().min(1).optional().nullable() }))
  .handler(async ({ data }) => {
    const { assertAdmin } = await import("./security.functions");
    await assertAdmin(data.accessToken);
    const { getEnv } = await import("@/lib/server/supabaseAdmin");
    const configured = isPayWayConfigured();
    const baseUrl = getEnv("PAYWAY_BASE_URL") || "https://checkout-sandbox.payway.com.kh";
    return {
      configured,
      sandbox: baseUrl.includes("sandbox"),
      callback: Boolean(getEnv("PAYWAY_CALLBACK_URL") || getEnv("APP_URL") || getEnv("VITE_APP_URL")),
      callbackSecret: Boolean(getEnv("PAYWAY_CALLBACK_SECRET")),
    };
  });
