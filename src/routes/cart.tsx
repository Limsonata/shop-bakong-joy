import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart-store";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Cart — Storefront" }] }),
  component: CartPage,
});

function CartPage() {
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const subtotal = useCart((s) => s.items.reduce((sum, i) => sum + i.price * i.quantity, 0));
  const router = useRouter();

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-semibold">Your cart is empty</h1>
        <p className="mt-2 text-muted-foreground">Discover something you'll love.</p>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/shop">Continue shopping</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Your cart</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <ul className="divide-y rounded-2xl border bg-card">
          {items.map((i) => (
            <li key={i.id} className="flex gap-4 p-4">
              <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-muted">
                {i.image && <img src={i.image} alt={i.name} className="h-full w-full object-cover" />}
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{i.name}</span>
                  <span className="font-semibold">{formatPrice(i.price * i.quantity)}</span>
                </div>
                <span className="text-sm text-muted-foreground">{formatPrice(i.price)} each</span>
                <div className="mt-auto flex items-center justify-between">
                  <div className="flex items-center rounded-full border">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setQty(i.id, i.quantity - 1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center text-sm">{i.quantity}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setQty(i.id, i.quantity + 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => remove(i.id)}>
                    <Trash2 className="mr-1 h-4 w-4" /> Remove
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="sticky top-20 h-fit rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Order summary</h2>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span>Calculated at checkout</span>
            </div>
          </div>
          <div className="my-4 border-t" />
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <Button className="mt-6 w-full rounded-full" size="lg" onClick={() => router.navigate({ to: "/checkout" })}>
            Checkout
          </Button>
        </aside>
      </div>
    </div>
  );
}