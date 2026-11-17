import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Package, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trackOrder } from "@/lib/api/security.functions";
import { PAYMENT_METHOD_LABEL, statusFor } from "@/lib/orderStatus";
import type { OrderStatus, PaymentMethod } from "@/lib/orderStore";

export const Route = createFileRoute("/track")({
  head: () => ({ meta: [{ title: "Track Order — BillieGrace Closet" }] }),
  validateSearch: (search: Record<string, unknown>): { ref?: string } => ({
    ref: typeof search.ref === "string" ? search.ref : undefined,
  }),
  component: TrackOrderPage,
});

type TrackedOrder = NonNullable<Awaited<ReturnType<typeof trackOrder>>>;

const STEPS: Array<{ status: OrderStatus; label: string }> = [
  { status: "pending", label: "Order placed" },
  { status: "paid", label: "Paid & packing" },
  { status: "shipped", label: "On the way" },
  { status: "done", label: "Delivered" },
];

function TrackOrderPage() {
  const search = Route.useSearch();
  const [reference, setReference] = useState(search.ref ?? "");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTrack = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reference.trim() || !phone.trim()) return;
    setLoading(true);
    setSearched(false);
    setOrder(null);
    setError(null);
    try {
      setOrder(await trackOrder({ data: { reference: reference.trim(), phone: phone.trim() } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not look up the order");
    } finally {
      setSearched(true);
      setLoading(false);
    }
  };

  const statusInfo = order
    ? statusFor({ status: order.status, paymentMethod: order.paymentMethod as PaymentMethod })
    : null;
  // COD orders skip "paid" until delivery.
  const steps = order?.paymentMethod === "cod" ? STEPS.filter((s) => s.status !== "paid") : STEPS;
  const reached = order ? steps.findIndex((s) => s.status === order.status) : -1;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <div className="mb-10 text-center">
        <div className="mb-4 flex justify-center">
          <div className="rounded-2xl bg-primary/10 p-3">
            <Package className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Track Your Order</h1>
        <p className="mt-3 text-muted-foreground">
          Enter your order number and the phone number you used at checkout.
        </p>
      </div>

      <form onSubmit={handleTrack} className="mb-8 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="track-ref">Order number</Label>
          <Input
            id="track-ref"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. BG-261117-7KQ3"
            autoCapitalize="characters"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="track-phone">Phone number</Label>
          <Input
            id="track-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 012 345 678"
            inputMode="tel"
          />
        </div>
        <Button type="submit" disabled={loading || !reference.trim() || !phone.trim()}>
          {loading ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" /> Track
            </>
          )}
        </Button>
      </form>

      {searched && !order && (
        <div className="py-12 text-center text-muted-foreground">
          <Package className="mx-auto mb-3 h-12 w-12 opacity-30" />
          <p className="font-medium">{error ?? "Order not found"}</p>
          <p className="mt-1 text-sm">
            Check the order number and phone number, or{" "}
            <Link to="/orders" className="underline underline-offset-2">
              see your orders
            </Link>{" "}
            if you have an account.
          </p>
        </div>
      )}

      {order && statusInfo && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="font-mono text-base">{order.reference}</CardTitle>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {order.status !== "cancelled" && (
              <ol className="grid grid-cols-4 gap-2 text-center text-xs" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
                {steps.map((step, index) => {
                  const done = index <= reached;
                  return (
                    <li key={step.status} className="flex flex-col items-center gap-1">
                      {done ? (
                        <CheckCircle2 className="h-6 w-6 text-primary" />
                      ) : (
                        <Circle className="h-6 w-6 text-muted-foreground/40" />
                      )}
                      <span className={done ? "font-medium" : "text-muted-foreground"}>{step.label}</span>
                    </li>
                  );
                })}
              </ol>
            )}

            {order.status === "pending" && order.paymentMethod === "khqr" && (
              <Button asChild className="w-full">
                <Link to="/pay/$orderId" params={{ orderId: order.id }}>
                  Pay now with KHQR
                </Link>
              </Button>
            )}

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
                <p className="font-medium">
                  {order.currency} {order.total.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Payment</p>
                <p className="font-medium">
                  {PAYMENT_METHOD_LABEL[order.paymentMethod as PaymentMethod] ?? order.paymentMethod}
                </p>
              </div>
            </div>

            {order.items.length > 0 && (
              <div>
                <p className="mb-2 text-sm text-muted-foreground">Items</p>
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
