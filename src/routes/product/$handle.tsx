import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Loader2, ArrowLeft, ShoppingBag, Check } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useCartStore } from "@/stores/cartStore";
import { getProductByHandle } from "@/lib/localStore";
import { toast } from "sonner";

export const Route = createFileRoute("/product/$handle")({
  head: ({ params }) => ({ meta: [{ title: `${params.handle} — Shop Bakong Joy` }] }),
  component: ProductDetail,
});

function ProductDetail() {
  const { handle } = Route.useParams();
  const addItem = useCartStore((s) => s.addItem);
  const isLoading = useCartStore((s) => s.isLoading);
  const [variantIdx, setVariantIdx] = useState(0);
  const [added, setAdded] = useState(false);

  const { data, isLoading: qLoading } = useQuery({
    queryKey: ["product", handle],
    queryFn: () => getProductByHandle(handle),
  });

  const variant = useMemo(() => data?.variants[variantIdx], [data, variantIdx]);
  const product = useMemo(() => (data ? { node: data } : null), [data]);

  const handleAdd = async () => {
    if (!product || !variant) return;
    await addItem({
      product,
      variantId: variant.id,
      variantTitle: variant.title,
      price: variant.price,
      quantity: 1,
      selectedOptions: variant.selectedOptions ?? [],
    });
    toast.success(`Added ${product.node.title} to cart`);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  if (qLoading) {
    return (
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2">
        <Skeleton className="aspect-square rounded-3xl" />
        <div className="space-y-5">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-7 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-14 w-full rounded-full" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold">Product not found</h1>
        <p className="mt-2 text-muted-foreground">This product may have been removed.</p>
        <Button asChild className="mt-8 rounded-full px-8">
          <Link to="/shop">Back to shop</Link>
        </Button>
      </div>
    );
  }

  const image = data?.images[0];
  const price = variant?.price ?? data?.price;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="mx-auto max-w-6xl px-4 py-10 sm:px-6"
    >
      <Link
        to="/shop"
        className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to shop
      </Link>

      <div className="grid gap-10 md:grid-cols-2 lg:gap-16">
        {/* Image */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="relative aspect-square overflow-hidden rounded-3xl liquid-glass"
        >
          {image ? (
            <img
              src={image.url}
              alt={image.altText ?? data.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <ShoppingBag className="h-16 w-16 text-muted-foreground/30" />
            </div>
          )}
          {data.collections.length > 0 && (
            <div className="absolute top-4 left-4">
              <Badge className="liquid-glass-card text-foreground border-0 shadow-none">
                {data.collections[0]}
              </Badge>
            </div>
          )}
        </motion.div>

        {/* Info */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.23, 1, 0.32, 1] }}
          className="flex flex-col gap-6"
        >
          <div>
            {data.productType && (
              <p className="text-sm font-medium text-accent uppercase tracking-widest mb-2">
                {data.productType}
              </p>
            )}
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
              {data.title}
            </h1>
            <p className="mt-3 text-3xl font-bold">
              {price.currencyCode}{" "}
              <span>{parseFloat(price.amount).toFixed(2)}</span>
            </p>
          </div>

          <Separator />

          {data.description && (
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
              {data.description}
            </p>
          )}

          {data.variants.length > 1 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Variant
              </p>
              <div className="flex flex-wrap gap-2">
                {data.variants.map((v, i) => (
                  <button
                    key={v.id}
                    onClick={() => setVariantIdx(i)}
                    disabled={!v.availableForSale}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-all border cursor-pointer ${
                      i === variantIdx
                        ? "bg-foreground text-background border-foreground"
                        : "bg-transparent text-foreground border-border hover:border-foreground"
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    {v.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3 mt-auto pt-2">
            <Button
              size="lg"
              className="w-full rounded-full py-6 text-base font-semibold transition-all"
              onClick={handleAdd}
              disabled={!variant?.availableForSale || isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : added ? (
                <Check className="mr-2 h-5 w-5" />
              ) : (
                <ShoppingBag className="mr-2 h-5 w-5" />
              )}
              {!variant?.availableForSale
                ? "Sold out"
                : added
                  ? "Added!"
                  : "Add to cart"}
            </Button>
            <Button variant="outline" size="lg" className="w-full rounded-full py-6 text-base" asChild>
              <Link to="/shop">Continue shopping</Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
