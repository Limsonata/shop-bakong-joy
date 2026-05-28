import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatPrice } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/orders/")({
  component: OrdersPage,
});

function OrdersPage() {
  const { user, loading: aLoading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!aLoading && !user) router.navigate({ to: "/auth" });
  }, [aLoading, user, router]);

  const { data, isLoading } = useQuery({
    queryKey: ["orders", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">My orders</h1>
      <div className="mt-6 space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
        ) : data && data.length > 0 ? (
          data.map((o) => (
            <Link
              key={o.id}
              to="/orders/$id"
              params={{ id: o.id }}
              className="flex items-center justify-between rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div>
                <div className="font-medium">{o.order_number}</div>
                <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-3">
                <PaymentBadge status={o.payment_status} />
                <span className="font-semibold">{formatPrice(o.total)}</span>
              </div>
            </Link>
          ))
        ) : (
          <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">
            No orders yet.
          </div>
        )}
      </div>
    </div>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const v = status === "paid" ? "default" : status === "failed" ? "destructive" : "secondary";
  return <Badge variant={v as any}>{status}</Badge>;
}