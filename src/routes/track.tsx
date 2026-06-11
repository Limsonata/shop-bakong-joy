import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Order, OrderStatus, OrderItem } from "@/lib/orderStore";

export const Route = createFileRoute("/track")({
  head: () => ({ meta: [{ title: "Track Order — hairora" }] }),
  component: TrackOrderPage,
});

const STATUS_LABELS: Record<OrderStatus, { label: string; color: string }> = {
  pending:   { label: "Pending",           color: "bg-yellow-100 text-yellow-800" },
  paid:      { label: "Payment received",  color: "bg-blue-100 text-blue-800" },
  shipped:   { label: "Shipped",           color: "bg-purple-100 text-purple-800" },
  done:      { label: "Completed",         color: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelled",         color: "bg-gray-100 text-gray-700" },
};

async function lookupOrder(ref: string): Promise<Order | null> {
  const trimmed = ref.trim();
  if (!trimmed) return null;

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .or(`bakong_reference.eq.${trimmed},id.eq.${trimmed}`)
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id,
      userId: data.user_id,
      customerName: data.customer_name,
      phone: data.phone,
      address: data.address,
      total: Number(data.total),
      currency: data.currency,
      bakongReference: data.bakong_reference,
      bakongTransactionId: data.bakong_transaction_id,
      status: data.status,
      items: (data.items as OrderItem[]) ?? [],
      createdAt: new Date(data.created_at).getTime(),
    };
  }

  // Demo mode: search localStorage
  try {
    const stored = localStorage.getItem("local-orders");
    if (!stored) return null;
    const orders: Order[] = JSON.parse(stored);
    return orders.find((o) => o.bakongReference === trimmed || o.id === trimmed) ?? null;
  } catch {
    return null;
  }
}

function TrackOrderPage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [searched, setSearched] = useState(false);

  const handleTrack = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setSearched(false);
    setOrder(null);
    const result = await lookupOrder(input);
    setOrder(result);
    setSearched(true);
    setLoading(false);
  };

  const statusInfo = order ? STATUS_LABELS[order.status] : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <div className="text-center mb-10">
        <div className="flex justify-center mb-4">
          <div className="p-3 rounded-2xl bg-primary/10">
            <Package className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Track Your Order</h1>
        <p className="mt-3 text-muted-foreground">
          Enter your ABA reference number or order ID below.
        </p>
      </div>

      <div className="flex gap-2 mb-8">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleTrack()}
          placeholder="e.g. TXN-12345678 or order ID"
          className="flex-1"
        />
        <Button onClick={handleTrack} disabled={loading || !input.trim()}>
          {loading ? (
            <span className="animate-spin inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
      </div>

      {searched && !order && (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto opacity-30 mb-3" />
          <p className="font-medium">Order not found</p>
          <p className="text-sm mt-1">
            Double-check your reference number, or{" "}
            <a href="/login" className="underline underline-offset-2">log in</a>{" "}
            to view your orders.
          </p>
        </div>
      )}

      {order && statusInfo && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="text-base font-medium text-muted-foreground">
                Order #{order.id.slice(0, 8).toUpperCase()}
              </CardTitle>
              <span className={`px-2.5 py-1 text-xs font-semibold rounded-full shrink-0 ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Customer</p>
                <p className="font-medium">{order.customerName}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Date</p>
                <p className="font-medium">{new Date(order.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total</p>
                <p className="font-medium">{order.currency} {order.total.toFixed(2)}</p>
              </div>
              {order.bakongReference && order.bakongReference !== "COD" && (
                <div>
                  <p className="text-muted-foreground">Reference</p>
                  <p className="font-medium font-mono text-xs">{order.bakongReference}</p>
                </div>
              )}
            </div>

            {order.items.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Items</p>
                <ul className="space-y-1">
                  {order.items.map((item, i) => (
                    <li key={i} className="flex justify-between text-sm">
                      <span>{item.title}</span>
                      <span className="text-muted-foreground">×{item.quantity}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
