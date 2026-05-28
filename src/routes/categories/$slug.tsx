import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard } from "@/components/site/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/categories/$slug")({
  component: CategoryDetail,
});

function CategoryDetail() {
  const { slug } = Route.useParams();
  const { data: category } = useQuery({
    queryKey: ["category", slug],
    queryFn: async () => (await supabase.from("categories").select("*").eq("slug", slug).maybeSingle()).data,
  });
  const { data: products, isLoading } = useQuery({
    queryKey: ["products", "by-cat", slug],
    queryFn: async () => {
      if (!category) return [];
      const { data } = await supabase
        .from("products")
        .select("id,slug,name,price,image_url,rating,is_new,is_best_seller,categories(name)")
        .eq("category_id", category.id);
      return data ?? [];
    },
    enabled: !!category,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">{category?.name ?? "Category"}</h1>
      {category?.description && <p className="mt-2 text-muted-foreground">{category.description}</p>}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />)
          : products?.map((p: any) => <ProductCard key={p.id} p={p} />)}
      </div>
    </div>
  );
}