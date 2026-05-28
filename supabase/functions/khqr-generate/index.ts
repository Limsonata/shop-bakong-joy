// Generate a Bakong KHQR string for a given order (dynamic amount per order).
// Merchant info is configured via environment variables.
import { BakongKHQR, IndividualInfo, khqrData } from "npm:bakong-khqr@1.0.20";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { orderId } = await req.json();
    if (!orderId || typeof orderId !== "string") {
      return json({ error: "orderId required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: order, error } = await supabase
      .from("orders")
      .select("id,order_number,total,payment_status")
      .eq("id", orderId)
      .maybeSingle();

    if (error || !order) return json({ error: "Order not found" }, 404);

    const accountId = Deno.env.get("BAKONG_ACCOUNT_ID") ?? "merchant@aclb";
    const merchantName = Deno.env.get("BAKONG_MERCHANT_NAME") ?? "Storefront";
    const merchantCity = Deno.env.get("BAKONG_MERCHANT_CITY") ?? "Phnom Penh";

    const info = new IndividualInfo(accountId, khqrData.currency.usd, merchantName, merchantCity, {
      amount: Number(order.total),
      billNumber: order.order_number,
      mobileNumber: "",
      storeLabel: merchantName,
      terminalLabel: "POS-01",
    });

    const khqr = new BakongKHQR();
    const result = khqr.generateIndividual(info);

    if (result.status) {
      return json({ error: "Failed to generate KHQR", details: result.status }, 500);
    }

    return json({
      qr: result.data.qr,
      md5: result.data.md5,
      amount: Number(order.total),
      orderNumber: order.order_number,
    });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}