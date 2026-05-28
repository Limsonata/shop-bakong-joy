import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, Upload, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/orders/$id")({
  component: OrderDetail,
});

function OrderDetail() {
  const { id } = Route.useParams();
  const { user, loading: aLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!aLoading && !user) router.navigate({ to: "/auth" });
  }, [aLoading, user, router]);

  const { data: order, refetch, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: khqr, isLoading: kLoading, error: kErr } = useQuery({
    queryKey: ["khqr", id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("khqr-generate", {
        body: { orderId: id },
      });
      if (error) throw error;
      return data as { qr: string; md5: string; amount: number; orderNumber: string };
    },
    enabled: !!order && order.payment_status === "pending",
    retry: false,
  });

  const [uploading, setUploading] = useState(false);

  const uploadProof = async (file: File) => {
    if (!user || !order) return;
    setUploading(true);
    const path = `${user.id}/${order.id}-${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("payment-proofs").upload(path, file);
    if (upErr) {
      setUploading(false);
      return toast.error(upErr.message);
    }
    const { error: updErr } = await supabase
      .from("orders")
      .update({ payment_proof_url: path, updated_at: new Date().toISOString() })
      .eq("id", order.id);
    setUploading(false);
    if (updErr) return toast.error(updErr.message);
    toast.success("Payment proof uploaded. We'll confirm shortly.");
    refetch();
  };

  if (isLoading || !order) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Order {order.order_number}</h1>
          <p className="text-sm text-muted-foreground">Placed {new Date(order.created_at).toLocaleString()}</p>
        </div>
        <PaymentBadge status={order.payment_status} />
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Bakong KHQR payment</h2>
          <p className="mt-1 text-sm text-muted-foreground">Scan with the Bakong app to pay {formatPrice(order.total)}.</p>

          {order.payment_status === "paid" ? (
            <div className="mt-6 flex flex-col items-center gap-2 rounded-xl bg-emerald-50 p-6 text-emerald-700">
              <CheckCircle2 className="h-10 w-10" />
              <span className="font-medium">Payment confirmed</span>
            </div>
          ) : kLoading ? (
            <div className="mt-6 flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : kErr ? (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              KHQR couldn't be generated. Please configure Bakong merchant settings.
            </div>
          ) : khqr ? (
            <div className="mt-6 flex flex-col items-center gap-3">
              <div className="rounded-2xl bg-white p-4">
                <QRCodeSVG value={khqr.qr} size={220} level="M" />
              </div>
              <div className="text-center text-sm">
                <div className="font-medium">{formatPrice(khqr.amount)}</div>
                <div className="text-xs text-muted-foreground">Ref: {khqr.orderNumber}</div>
              </div>
            </div>
          ) : null}

          {order.payment_status !== "paid" && (
            <div className="mt-6">
              <p className="mb-2 text-sm font-medium">After paying, upload your receipt screenshot:</p>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/30 px-4 py-6 text-sm text-muted-foreground hover:bg-muted/60">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {order.payment_proof_url ? "Replace screenshot" : "Upload screenshot"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => e.target.files?.[0] && uploadProof(e.target.files[0])}
                />
              </label>
              {order.payment_proof_url && (
                <p className="mt-2 text-xs text-emerald-600">Receipt uploaded. Awaiting confirmation.</p>
              )}
            </div>
          )}
        </section>

        <section className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold">Items</h2>
            <ul className="mt-3 divide-y text-sm">
              {order.order_items?.map((i: any) => (
                <li key={i.id} className="flex justify-between py-2">
                  <span>{i.product_name} × {i.quantity}</span>
                  <span>{formatPrice(Number(i.unit_price) * i.quantity)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="border-t pt-3">
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>{formatPrice(order.total)}</span>
            </div>
          </div>
          <div className="border-t pt-3 text-sm text-muted-foreground">
            <div className="font-medium text-foreground">Delivery</div>
            <div className="mt-1">{order.full_name} · {order.phone}</div>
            <div>{order.address}</div>
            <div>{order.city}</div>
            {order.notes && <div className="mt-1 italic">"{order.notes}"</div>}
          </div>
        </section>
      </div>

      <div className="mt-6">
        <Link to="/orders" className="text-sm text-muted-foreground hover:underline">← All orders</Link>
      </div>
    </div>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const variant = status === "paid" ? "default" : status === "failed" ? "destructive" : "secondary";
  const label = status === "paid" ? "Paid" : status === "failed" ? "Failed" : "Pending";
  return <Badge variant={variant as any}>{label}</Badge>;
}