import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Package, ShoppingBag, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { getMyOrders, type Order, type OrderStatus } from "@/lib/orderStore";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/orders")({
  head: () => ({ meta: [{ title: "My Orders" }] }),
  component: MyOrdersPage,
});

const STATUS_LABELS: Record<OrderStatus, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  paid: { label: "Payment received", color: "bg-blue-100 text-blue-800" },
  shipped: { label: "Shipped", color: "bg-purple-100 text-purple-800" },
  done: { label: "Completed", color: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-700" },
};

function MyOrdersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/login", replace: true });
      return;
    }

    let cancelled = false;
    getMyOrders()
      .then((data) => { if (!cancelled) setOrders(data); })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    // Realtime: re-fetch when any of this user's orders change
    const channel = supabase
      ?.channel(`orders-user-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` }, () => {
        getMyOrders().then((data) => { if (!cancelled) setOrders(data); });
      })
      .subscribe();

    return () => {
      cancelled = true;
      channel?.unsubscribe();
    };
  }, [authLoading, user, navigate]);

  if (authLoading || !user) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">My Orders</h1>
          <p className="mt-2 text-muted-foreground">View your order history and status</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/account">Back to Account</Link>
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading orders...</p>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ShoppingBag className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">No orders yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              When you place an order it will show up here.
            </p>
            <Button asChild className="mt-6">
              <Link to="/shop">
                Start shopping <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const statusInfo = STATUS_LABELS[order.status];
            return (
              <Card key={order.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Package className="h-4 w-4" />
                      {order.bakongReference || order.id.slice(0, 12)}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {new Date(order.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${statusInfo.color}`}
                  >
                    {statusInfo.label}
                  </span>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        {item.imageUrl && (
                          <div className="h-12 w-12 overflow-hidden rounded-md bg-muted">
                            <img
                              src={item.imageUrl}
                              alt={item.title}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{item.title}</p>
                          <p className="text-xs text-muted-foreground">Qty {item.quantity}</p>
                        </div>
                        <p className="text-sm">
                          {item.currency} {(item.price * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="text-sm font-medium">Total</span>
                    <span className="font-semibold">
                      {order.currency} {order.total.toFixed(2)}
                    </span>
                  </div>

                  {order.bakongTransactionId && (
                    <p className="text-xs text-muted-foreground">
                      ABA PayWay transaction: {order.bakongTransactionId}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
