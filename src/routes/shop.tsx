import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard } from "@/components/site/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const searchSchema = z.object({
  q: z.string().optional().catch(undefined),
  category: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/shop")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Shop — Storefront" }] }),
  component: ShopPage,
});

function ShopPage() {
  const { q: initialQ, category: initialCat } = Route.useSearch();
  const [q, setQ] = useState(initialQ ?? "");
  const [maxPrice, setMaxPrice] = useState(500);
  const [selectedCats, setSelectedCats] = useState<string[]>(initialCat ? [initialCat] : []);
  const [sort, setSort] = useState<string>("new");

  const { data: cats } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").order("name");
      return data ?? [];
    },
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ["products", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,slug,name,price,image_url,rating,is_new,is_best_seller,category_id,created_at,categories(name,slug)");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (!products) return [];
    let list = products.filter((p: any) => Number(p.price) <= maxPrice);
    if (q.trim()) {
      const term = q.toLowerCase();
      list = list.filter((p: any) => p.name.toLowerCase().includes(term));
    }
    if (selectedCats.length) {
      list = list.filter((p: any) => selectedCats.includes(p.categories?.slug));
    }
    switch (sort) {
      case "price-asc":
        list.sort((a: any, b: any) => Number(a.price) - Number(b.price));
        break;
      case "price-desc":
        list.sort((a: any, b: any) => Number(b.price) - Number(a.price));
        break;
      case "popular":
        list.sort((a: any, b: any) => Number(b.rating) - Number(a.rating));
        break;
      case "new":
      default:
        list.sort((a: any, b: any) => +new Date(b.created_at) - +new Date(a.created_at));
    }
    return list;
  }, [products, q, maxPrice, selectedCats, sort]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-8">
          <div className="space-y-2">
            <Label>Search</Label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search..." />
          </div>
          <div className="space-y-3">
            <Label>Categories</Label>
            <div className="space-y-2">
              {cats?.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selectedCats.includes(c.slug)}
                    onCheckedChange={(v) =>
                      setSelectedCats((s) =>
                        v ? [...s, c.slug] : s.filter((x) => x !== c.slug),
                      )
                    }
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <Label>Max price: ${maxPrice}</Label>
            <Slider
              value={[maxPrice]}
              max={500}
              step={10}
              onValueChange={(v) => setMaxPrice(v[0])}
            />
          </div>
          <div className="space-y-2">
            <Label>Sort by</Label>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New arrivals</SelectItem>
                <SelectItem value="popular">Popularity</SelectItem>
                <SelectItem value="price-asc">Price: low to high</SelectItem>
                <SelectItem value="price-desc">Price: high to low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </aside>

        <div>
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-3xl font-semibold tracking-tight">Shop</h1>
            <span className="text-sm text-muted-foreground">{filtered.length} products</span>
          </div>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border bg-card p-16 text-center text-muted-foreground">
              No products match your filters.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {filtered.map((p: any) => <ProductCard key={p.id} p={p} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}