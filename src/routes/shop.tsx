import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { z } from "zod";
import { PackageSearch } from "lucide-react";
import { ProductCard } from "@/components/site/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getProducts, getCollections } from "@/lib/localStore";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Slider } from "@/components/ui/slider";

const searchSchema = z.object({
  q: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/shop")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Shop — hairora" }] }),
  component: ShopPage,
});

function ShopPage() {
  const { q: initialQ } = Route.useSearch();
  const [q, setQ] = useState(initialQ ?? "");
  const [sortBy, setSortBy] = useState("default");
  const [activeCollection, setActiveCollection] = useState("");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 99999]);

  const { data, isLoading } = useQuery({
    queryKey: ["products", "all"],
    queryFn: () => getProducts({ first: 50 }),
  });

  const { data: collections } = useQuery({
    queryKey: ["collections"],
    queryFn: () => getCollections({ first: 20 }),
  });

  const allPrices = useMemo(() => data?.map((p) => parseFloat(p.node.price.amount)) ?? [], [data]);
  const minPrice = allPrices.length ? Math.floor(Math.min(...allPrices)) : 0;
  const maxPrice = allPrices.length ? Math.ceil(Math.max(...allPrices)) : 99999;

  useEffect(() => {
    if (allPrices.length) setPriceRange([minPrice, maxPrice]);
  }, [minPrice, maxPrice]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    let result = data;
    if (term) {
      result = result.filter(
        (p) =>
          p.node.title.toLowerCase().includes(term) ||
          p.node.description.toLowerCase().includes(term),
      );
    }
    if (activeCollection) {
      result = result.filter((p) =>
        p.node.collections.some((c) =>
          c.toLowerCase().includes(activeCollection.toLowerCase()),
        ),
      );
    }
    result = result.filter((p) => {
      const price = parseFloat(p.node.price.amount);
      return price >= priceRange[0] && price <= priceRange[1];
    });
    if (sortBy === "price-asc") {
      result = [...result].sort(
        (a, b) => parseFloat(a.node.price.amount) - parseFloat(b.node.price.amount),
      );
    } else if (sortBy === "price-desc") {
      result = [...result].sort(
        (a, b) => parseFloat(b.node.price.amount) - parseFloat(a.node.price.amount),
      );
    } else if (sortBy === "name-asc") {
      result = [...result].sort((a, b) => a.node.title.localeCompare(b.node.title));
    }
    return result;
  }, [data, q, activeCollection, sortBy, priceRange]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      {/* Search + Sort bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search products..."
          className="flex-1"
        />
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Featured</SelectItem>
            <SelectItem value="price-asc">Price: Low → High</SelectItem>
            <SelectItem value="price-desc">Price: High → Low</SelectItem>
            <SelectItem value="name-asc">Name A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Collection filter pills */}
      {collections && collections.length > 0 && (
        <ToggleGroup
          type="single"
          value={activeCollection}
          onValueChange={(val) => setActiveCollection(val)}
          className="flex flex-wrap gap-2 mb-6 justify-start"
        >
          <ToggleGroupItem
            value=""
            className="rounded-full px-4 h-8 text-sm font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            All
          </ToggleGroupItem>
          {collections.map((col) => (
            <ToggleGroupItem
              key={col.node.id}
              value={col.node.title}
              className="rounded-full px-4 h-8 text-sm font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              {col.node.title}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}

      {/* Price range filter */}
      {allPrices.length > 0 && minPrice < maxPrice && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Price</span>
            <span className="text-sm text-muted-foreground">
              ${priceRange[0]} – ${priceRange[1]}
            </span>
          </div>
          <Slider
            min={minPrice}
            max={maxPrice}
            step={1}
            value={priceRange}
            onValueChange={(val) => setPriceRange(val as [number, number])}
            className="w-full"
          />
        </div>
      )}

      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Shop</h1>
        <span className="text-sm text-muted-foreground">{filtered.length} products</span>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border bg-card p-16 text-center text-muted-foreground flex flex-col items-center gap-4">
          <PackageSearch className="w-12 h-12 opacity-40" />
          <p className="text-lg font-medium">No products found</p>
          <p className="text-sm">Try a different search or clear the filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((product) => (
            <ProductCard key={product.node.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
