import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductCard } from "@/components/site/ProductCard";
import {
  storefrontApiRequest,
  STOREFRONT_PRODUCTS_QUERY,
  type ShopifyProduct,
} from "@/lib/shopify";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Storefront — Less, but better." },
      {
        name: "description",
        content: "A curated storefront of considered everyday goods. Secure checkout powered by Shopify.",
      },
      { property: "og:title", content: "Storefront" },
      { property: "og:description", content: "Minimal modern shopping." },
    ],
  }),
  component: Index,
});

function Index() {
  const { data, isLoading } = useQuery({
    queryKey: ["products", "featured"],
    queryFn: async () => {
      const res = await storefrontApiRequest(STOREFRONT_PRODUCTS_QUERY, { first: 8, query: null });
      return (res?.data?.products?.edges ?? []) as ShopifyProduct[];
    },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground text-xl font-bold text-background">
            S
          </div>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            Less, but better.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-balance text-muted-foreground sm:text-lg">
            A curated storefront of considered everyday goods. Secure checkout powered by Shopify.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg" className="rounded-full">
              <Link to="/shop">
                Shop now <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-10">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Featured products</h2>
          <Link to="/shop" className="text-sm text-muted-foreground hover:text-foreground">
            View all →
          </Link>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
            ))
          ) : !data || data.length === 0 ? (
            <div className="col-span-full rounded-2xl border bg-card p-16 text-center text-muted-foreground">
              No products found. Tell me what to add — e.g. "create a product called Linen Tee for $39".
            </div>
          ) : (
            data.map((product) => <ProductCard key={product.node.id} product={product} />)
          )}
        </div>
      </section>
    </div>
  );
}
