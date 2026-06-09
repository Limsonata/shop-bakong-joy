import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { isSupabaseConfigured } from "@/lib/supabase";
import { deleteProduct, getProducts, type Product } from "@/lib/productStore";

export const Route = createFileRoute("/admin/products")({
  head: () => ({ meta: [{ title: "Products - Admin" }] }),
  component: ProductsAdmin,
});

function ProductsAdmin() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const isProductsIndex = pathname.replace(/\/$/, "") === "/admin/products";

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const data = await getProducts({ first: 100 });
      setProducts(data.map((edge) => edge.node));
    } catch (error) {
      console.error(error);
      toast.error("Failed to load products");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isProductsIndex) {
      loadProducts();
    }
  }, [isProductsIndex]);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeletingId(pendingDelete.id);
    const ok = await deleteProduct(pendingDelete.id);
    if (ok) {
      toast.success(`Deleted "${pendingDelete.title}"`);
      setProducts((prev) => prev.filter((p) => p.id !== pendingDelete.id));
    } else {
      toast.error("Failed to delete product");
    }
    setDeletingId(null);
    setPendingDelete(null);
  };

  const filtered = products.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      p.handle.toLowerCase().includes(q) ||
      p.productType.toLowerCase().includes(q)
    );
  });

  if (!isProductsIndex) {
    return (
      <RequireAdmin>
        <Outlet />
      </RequireAdmin>
    );
  }

  return (
    <RequireAdmin>
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-4">
              <Link to="/admin" className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-xl font-semibold">Products</h1>
            </div>
            <Button asChild>
              <Link to="/admin/products/new">
                <Plus className="mr-2 h-4 w-4" /> Add Product
              </Link>
            </Button>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          {!isSupabaseConfigured && (
            <div className="mb-6 rounded-md border border-yellow-300 bg-yellow-50 p-4 text-sm">
              <p className="font-medium text-yellow-900">Demo mode</p>
              <p className="mt-1 text-yellow-800">
                Changes are saved to your browser only. Configure Supabase to persist them
                permanently across all visitors.
              </p>
            </div>
          )}

          <div className="mb-4 relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="pl-9 max-w-md"
            />
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading products...</p>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-lg font-medium">
                  {search ? "No products match your search" : "No products yet"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {search
                    ? "Try a different search term."
                    : "Add your first product to get started."}
                </p>
                {!search && (
                  <Button asChild className="mt-4">
                    <Link to="/admin/products/new">
                      <Plus className="mr-2 h-4 w-4" /> Add Product
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-hidden rounded-md border">
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                      Product
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                      Price
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                      Stock
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((product) => (
                    <tr key={product.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 overflow-hidden rounded-md bg-muted">
                            {product.images[0] && (
                              <img
                                src={product.images[0].url}
                                alt={product.title}
                                className="h-full w-full object-cover"
                              />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{product.title}</p>
                            <p className="text-xs text-muted-foreground">{product.handle}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {product.productType || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {product.price.currencyCode} {Number(product.price.amount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {product.variants[0]?.availableForSale ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                            In stock
                          </span>
                        ) : (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                            Out of stock
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button asChild variant="ghost" size="icon">
                            <Link to="/admin/products/$id" params={{ id: product.id }}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setPendingDelete(product)}
                            disabled={deletingId === product.id}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>

        <AlertDialog
          open={pendingDelete !== null}
          onOpenChange={(open) => !open && setPendingDelete(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this product?</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingDelete?.title} will be removed from the storefront. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </RequireAdmin>
  );
}
