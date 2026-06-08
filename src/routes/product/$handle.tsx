import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCartStore } from "@/stores/cartStore";
import { getProductByHandle } from "@/lib/localStore";
import { toast } from "sonner";

export const Route = createFileRoute("/product/$handle")({
  head: ({ params }) => ({ meta: [{ title: `${params.handle} — Storefront` }] }),
  component: ProductDetail,
});

function ProductDetail() {
  const { handle } = Route.useParams();
  const addItem = useCartStore((s) => s.addItem);
  const isLoading = useCartStore((s) => s.isLoading);
  const [variantIdx, setVariantIdx] = useState(0);

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
  };

  if (qLoading) {
    return (
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-2">
        <Skeleton className="aspect-square rounded-2xl" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold">Product not found</h1>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/shop">Back to shop</Link>
        </Button>
      </div>
    );
  }

  const image = data?.images[0];
  const price = variant?.price ?? data?.price;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link
        to="/shop"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to shop
      </Link>
      <div className="grid gap-8 md:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-2xl bg-muted">
          {image && (
            <img
              src={image.url}
              alt={image.altText ?? data.title}
              className="h-full w-full object-cover"
            />
          )}
        </div>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{data.title}</h1>
            <p className="mt-2 text-2xl font-semibold">
              {price.currencyCode} {parseFloat(price.amount).toFixed(2)}
            </p>
          </div>
          {data.description && (
            <p className="whitespace-pre-line text-muted-foreground">{data.description}</p>
          )}
          {data.variants.length > 1 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Variant</p>
              <div className="flex flex-wrap gap-2">
                {data.variants.map((v, i) => (
                  <Button
                    key={v.id}
                    variant={i === variantIdx ? "default" : "outline"}
                    size="sm"
                    className="rounded-full"
                    onClick={() => setVariantIdx(i)}
                    disabled={!v.availableForSale}
                  >
                    {v.title}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <Button
            size="lg"
            className="w-full rounded-full"
            onClick={handleAdd}
            disabled={!variant?.availableForSale || isLoading}
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {variant?.availableForSale ? "Add to cart" : "Sold out"}
          </Button>
        </div>
      </div>
    </div>
  );
}
