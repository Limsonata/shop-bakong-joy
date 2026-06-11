import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Package, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { getAllOrders, updateOrderStatus, type Order, type OrderStatus } from "@/lib/orderStore";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin/orders")({
  head: () => ({ meta: [{ title: "Orders - Admin" }] }),
  component: OrdersAdmin,
});

const STATUS_OPTIONS: OrderStatus[] = ["pending", "paid", "shipped", "done", "cancelled"];

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  done: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-800",
};

function OrdersAdmin() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const data = await getAllOrders();
      setOrders(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load orders");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();

    // Realtime: auto-refresh when any order is inserted or updated
    const channel = supabase
      ?.channel("admin-orders")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, () => {
        toast.info("New order received!");
        loadOrders();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, () => {
        loadOrders();
      })
      .subscribe();

    return () => { channel?.unsubscribe(); };
  }, []);

  const handleStatusChange = async (id: string, status: OrderStatus) => {
    const ok = await updateOrderStatus(id, status);
    if (ok) {
      toast.success("Status updated");
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    } else {
      toast.error("Failed to update status");
    }
  };

  return (
    <RequireAdmin>
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-4">
              <Link to="/admin" className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-xl font-semibold">Orders</h1>
            </div>
            <Button variant="outline" size="sm" onClick={loadOrders} disabled={isLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading orders...</p>
          ) : orders.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Package className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-lg font-medium">No orders yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Orders will appear here when customers complete checkout.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <Card key={order.id}>
                  <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                    <div className="space-y-1">
                      <CardTitle className="text-base">
                        {order.bakongReference || order.id}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {new Date(order.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[order.status]}`}
                      >
                        {order.status}
                      </span>
                      <Select
                        value={order.status}
                        onValueChange={(value) =>
                          handleStatusChange(order.id, value as OrderStatus)
                        }
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium uppercase text-muted-foreground">
                          Customer
                        </p>
                        <p className="text-sm">{order.customerName}</p>
                        <p className="text-sm text-muted-foreground">{order.phone}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{order.address}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase text-muted-foreground">
                          Payment
                        </p>
                        <p className="text-sm">
                          {order.currency} {order.total.toFixed(2)}
                        </p>
                        {order.bakongTransactionId && (
                          <p className="text-sm text-muted-foreground">
                            ABA PayWay Tx: {order.bakongTransactionId}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                        Items
                      </p>
                      <div className="space-y-2">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span>
                              {item.title} × {item.quantity}
                            </span>
                            <span className="text-muted-foreground">
                              {item.currency} {(item.price * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
    </RequireAdmin>
  );
}
