import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/lib/cart-store";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const schema = z.object({
  full_name: z.string().min(2).max(100),
  phone: z.string().min(6).max(20),
  address: z.string().min(5).max(500),
  city: z.string().min(2).max(100),
  notes: z.string().max(500).optional(),
});

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout — Storefront" }] }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { user, loading: aLoading } = useAuth();
  const router = useRouter();
  const items = useCart((s) => s.items);
  const subtotal = useCart((s) => s.items.reduce((sum, i) => sum + i.price * i.quantity, 0));
  const clear = useCart((s) => s.clear);

  const [form, setForm] = useState({ full_name: "", phone: "", address: "", city: "", notes: "" });
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!aLoading && !user) router.navigate({ to: "/auth" });
  }, [aLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name,phone").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) setForm((f) => ({ ...f, full_name: data.full_name ?? "", phone: data.phone ?? "" }));
    });
  }, [user]);

  const useMyLocation = () => {
    if (!navigator.geolocation) return toast.error("Geolocation not supported");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
        toast.success("Location pinned");
      },
      () => {
        setLocating(false);
        toast.error("Couldn't get your location");
      },
    );
  };

  const placeOrder = async () => {
    if (!user) return;
    if (items.length === 0) return toast.error("Your cart is empty");
    const parsed = schema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setSubmitting(true);
    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        subtotal,
        total: subtotal,
        full_name: parsed.data.full_name,
        phone: parsed.data.phone,
        address: parsed.data.address,
        city: parsed.data.city,
        notes: parsed.data.notes ?? null,
        lat: loc?.lat ?? null,
        lng: loc?.lng ?? null,
      })
      .select()
      .single();
    if (error || !order) {
      setSubmitting(false);
      return toast.error(error?.message ?? "Could not create order");
    }
    const { error: itemsError } = await supabase.from("order_items").insert(
      items.map((i) => ({
        order_id: order.id,
        product_id: i.id,
        product_name: i.name,
        product_image: i.image,
        unit_price: i.price,
        quantity: i.quantity,
      })),
    );
    if (itemsError) {
      setSubmitting(false);
      return toast.error(itemsError.message);
    }
    clear();
    setSubmitting(false);
    router.navigate({ to: "/orders/$id", params: { id: order.id } });
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Checkout</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <div className="space-y-2"><Label>Province / City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <div className="space-y-2"><Label>Delivery address</Label><Textarea rows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="space-y-2">
            <Label>Pin location</Label>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" onClick={useMyLocation} disabled={locating}>
                {locating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
                {loc ? "Update location" : "Use current location"}
              </Button>
              {loc && (
                <span className="text-xs text-muted-foreground">
                  {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
                </span>
              )}
            </div>
            {loc && (
              <iframe
                title="Map"
                className="mt-3 h-56 w-full rounded-xl border"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${loc.lng - 0.005},${loc.lat - 0.003},${loc.lng + 0.005},${loc.lat + 0.003}&layer=mapnik&marker=${loc.lat},${loc.lng}`}
              />
            )}
          </div>
          <div className="space-y-2"><Label>Notes (optional)</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>

        <aside className="sticky top-20 h-fit space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Summary</h2>
          <ul className="divide-y text-sm">
            {items.map((i) => (
              <li key={i.id} className="flex justify-between py-2">
                <span className="line-clamp-1">{i.name} × {i.quantity}</span>
                <span>{formatPrice(i.price * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="border-t pt-4">
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
          </div>
          <Button className="w-full rounded-full" size="lg" disabled={submitting} onClick={placeOrder}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Place order & pay
          </Button>
        </aside>
      </div>
    </div>
  );
}