import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Star, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/lib/cart-store";
import { formatPrice } from "@/lib/format";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/products/$slug")({
  component: ProductDetail,
});

function ProductDetail() {
  const { slug } = Route.useParams();
  const add = useCart((s) => s.add);
  const [qty, setQty] = useState(1);

  const { data: p, isLoading } = useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*, categories(name,slug)")
        .eq("slug", slug)
        .maybeSingle();
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 md:grid-cols-2">
          <Skeleton className="aspect-square rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </div>
    );
  }
  if (!p) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold">Product not found</h1>
        <Link to="/shop" className="mt-4 inline-block text-sm underline">Back to shop</Link>
      </div>
    );
  }

  const price = Number(p.price);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border bg-muted">
          {p.image_url && <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />}
        </div>
        <div className="space-y-5">
          {p.categories?.name && (
            <Link to="/categories/$slug" params={{ slug: p.categories.slug }} className="text-xs uppercase tracking-wide text-muted-foreground hover:underline">
              {p.categories.name}
            </Link>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">{p.name}</h1>
            {p.is_new && <Badge variant="secondary">New</Badge>}
            {p.is_best_seller && <Badge>Best Seller</Badge>}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Star className="h-4 w-4 fill-current text-amber-500" /> {Number(p.rating).toFixed(1)}
          </div>
          <div className="text-3xl font-semibold">{formatPrice(price)}</div>
          <p className="text-muted-foreground">{p.description}</p>
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-full border">
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setQty(Math.max(1, qty - 1))}>−</Button>
              <span className="w-10 text-center text-sm">{qty}</span>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setQty(qty + 1)}>+</Button>
            </div>
            <Button
              size="lg"
              className="rounded-full"
              onClick={() => {
                add({ id: p.id, name: p.name, price, image: p.image_url }, qty);
                toast.success(`Added ${qty} × ${p.name}`);
              }}
            >
              <ShoppingCart className="mr-2 h-4 w-4" /> Add to cart
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{p.stock} in stock</p>
        </div>
      </div>
    </div>
  );
}