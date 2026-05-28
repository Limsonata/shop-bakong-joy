import { Link } from "@tanstack/react-router";
import { Star, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/lib/cart-store";
import { formatPrice } from "@/lib/format";
import { toast } from "sonner";

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  price: number | string;
  image_url: string | null;
  rating: number | string;
  is_new?: boolean | null;
  is_best_seller?: boolean | null;
  categories?: { name: string } | null;
};

export function ProductCard({ p }: { p: ProductCardData }) {
  const add = useCart((s) => s.add);
  const price = typeof p.price === "string" ? parseFloat(p.price) : p.price;

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-md">
      <Link to="/products/$slug" params={{ slug: p.slug }} className="relative block aspect-square overflow-hidden bg-muted">
        {p.image_url ? (
          <img
            src={p.image_url}
            alt={p.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">No image</div>
        )}
        <div className="absolute left-3 top-3 flex gap-1">
          {p.is_new && <Badge variant="secondary">New</Badge>}
          {p.is_best_seller && <Badge>Best Seller</Badge>}
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {p.categories?.name && (
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {p.categories.name}
          </span>
        )}
        <Link to="/products/$slug" params={{ slug: p.slug }} className="line-clamp-1 font-medium hover:underline">
          {p.name}
        </Link>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Star className="h-3 w-3 fill-current text-amber-500" />
          <span>{Number(p.rating).toFixed(1)}</span>
        </div>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="font-semibold">{formatPrice(price)}</span>
          <Button
            size="icon"
            variant="secondary"
            className="rounded-full"
            onClick={(e) => {
              e.preventDefault();
              add({ id: p.id, name: p.name, price, image: p.image_url });
              toast.success(`Added ${p.name} to cart`);
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}