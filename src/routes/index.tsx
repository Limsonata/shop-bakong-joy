import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/site/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Storefront — Minimal modern shopping" },
      { name: "description", content: "Discover curated products with a clean, fast checkout and Bakong KHQR payment." },
      { property: "og:title", content: "Storefront" },
      { property: "og:description", content: "Minimal modern shopping with Bakong KHQR." },
    ],
  }),
  component: Index,
});

function Index() {
  const { data: featured, isLoading: lFeat } = useQuery({
    queryKey: ["products", "featured"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,slug,name,price,image_url,rating,is_new,is_best_seller,categories(name)")
        .eq("is_featured", true)
        .limit(8);
      if (error) throw error;
      return data;
    },
  });
  const { data: best, isLoading: lBest } = useQuery({
    queryKey: ["products", "best"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,slug,name,price,image_url,rating,is_new,is_best_seller,categories(name)")
        .eq("is_best_seller", true)
        .limit(4);
      if (error) throw error;
      return data;
    },
  });
  const { data: cats, isLoading: lCats } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      {/* Hero */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground text-background text-xl font-bold">
            S
          </div>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            Less, but better.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-balance text-muted-foreground sm:text-lg">
            A curated storefront of considered everyday goods. Pay seamlessly with Bakong KHQR.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg" className="rounded-full">
              <Link to="/shop">
                Shop now <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full">
              <Link to="/categories">Browse categories</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Categories grid */}
      <section className="py-10">
        <SectionHeader title="Shop by category" href="/categories" />
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {lCats
            ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-2xl" />)
            : cats?.map((c) => (
                <Link
                  key={c.id}
                  to="/categories/$slug"
                  params={{ slug: c.slug }}
                  className="group relative aspect-square overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-md"
                >
                  {c.image_url && (
                    <img
                      src={c.image_url}
                      alt={c.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-3 left-3 text-sm font-medium text-white">
                    {c.name}
                  </div>
                </Link>
              ))}
        </div>
      </section>

      {/* Featured */}
      <section className="py-10">
        <SectionHeader title="Featured products" href="/shop" />
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {lFeat
            ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />)
            : featured?.map((p: any) => <ProductCard key={p.id} p={p} />)}
        </div>
      </section>

      {/* Best sellers */}
      <section className="py-10">
        <SectionHeader title="Best sellers" href="/shop" />
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {lBest
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />)
            : best?.map((p: any) => <ProductCard key={p.id} p={p} />)}
        </div>
      </section>
    </div>
  );
}

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-end justify-between">
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      <Link to={href} className="text-sm text-muted-foreground hover:text-foreground">
        View all →
      </Link>
    </div>
  );
}
