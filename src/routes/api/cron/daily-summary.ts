import { createFileRoute } from "@tanstack/react-router";

// Vercel Cron calls this every evening (see vercel.json: 14:00 UTC = 21:00 in
// Phnom Penh). Vercel sends "Authorization: Bearer <CRON_SECRET>"; without a
// CRON_SECRET set, the route refuses every call.
// Keep `server` as a plain property (no `as never` around the options):
// TanStack's compiler only strips it from the browser bundle when it can see it.
export const Route = createFileRoute("/api/cron/daily-summary")({
  // @ts-expect-error `server` is typed by @tanstack/react-start, which augments a
  // different copy of router-core than the one react-router resolves here.
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const { cronAuthorised } = await import("@/lib/server/cronAuth");
        if (!cronAuthorised(request.headers.get("authorization"))) {
          return new Response("unauthorized", { status: 401 });
        }

        try {
          const { createServiceClient } = await import("@/lib/server/supabaseAdmin");
          const { sendDailySummary } = await import("@/lib/server/dailySummary");
          const result = await sendDailySummary(createServiceClient());
          return Response.json(result, { status: result.summary ? 200 : 502 });
        } catch (error) {
          console.error("[cron/daily-summary]", error);
          return Response.json(
            { error: error instanceof Error ? error.message : "failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
