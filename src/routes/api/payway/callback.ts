import { createFileRoute } from "@tanstack/react-router";

// ABA PayWay posts here when a KHQR payment completes:
//   { "tran_id": "...", "apv": "...", "status": "0", "return_params": "..." }
// The body is never trusted: the payment is re-checked with ABA before the
// order is marked paid.
export const Route = createFileRoute("/api/payway/callback")({
  // @ts-expect-error `server` is typed by @tanstack/react-start, which augments a
  // different copy of router-core than the one react-router resolves here.
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const json = (body: unknown, status = 200) =>
          new Response(JSON.stringify(body), {
            status,
            headers: { "content-type": "application/json" },
          });

        const { getEnv, createServiceClient } = await import("@/lib/server/supabaseAdmin");
        const secret = getEnv("PAYWAY_CALLBACK_SECRET");
        if (secret && new URL(request.url).searchParams.get("key") !== secret) {
          return json({ ok: false }, 401);
        }

        let tranId = "";
        try {
          const text = await request.text();
          let body: Record<string, unknown> = {};
          try {
            body = JSON.parse(text) as Record<string, unknown>;
          } catch {
            body = Object.fromEntries(new URLSearchParams(text));
          }
          tranId = String(body.tran_id ?? body.tranId ?? "").trim();
        } catch {
          return json({ ok: false, error: "Bad body" }, 400);
        }
        if (!tranId || tranId.length > 20) return json({ ok: false, error: "Missing tran_id" }, 400);

        try {
          const { orderIdForTranId, refreshKhqrPayment } = await import("@/lib/server/payments");
          const supabase = createServiceClient();
          const orderId = await orderIdForTranId(supabase, tranId);
          if (!orderId) return json({ ok: false, error: "Unknown tran_id" }, 404);
          const result = await refreshKhqrPayment(supabase, orderId);
          return json({ ok: true, state: result.state });
        } catch (error) {
          console.error("[PayWay callback]", error);
          // Non-2xx lets ABA retry; polling from the checkout page is the backup.
          return json({ ok: false }, 500);
        }
      },
    },
  },
});
