import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { ProductForm } from "@/components/admin/ProductForm";
import { getProductById, updateProduct, type Product } from "@/lib/productStore";

export const Route = createFileRoute("/admin/products/$id")({
  head: () => ({ meta: [{ title: "Edit Product - Admin" }] }),
  component: EditProductPage,
});

function EditProductPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getProductById(id)
      .then((p) => {
        if (cancelled) return;
        setProduct(p);
        setIsLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error(error);
        toast.error("Failed to load product");
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <RequireAdmin>
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6">
            <div className="flex items-center gap-4">
              <Link
                to="/admin/products"
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-xl font-semibold">
                {product ? `Edit: ${product.title}` : "Edit Product"}
              </h1>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading product...</p>
          ) : !product ? (
            <p className="text-sm text-muted-foreground">Product not found.</p>
          ) : (
            <ProductForm
              initial={product}
              submitLabel="Save changes"
              onSubmit={async (input) => {
                try {
                  await updateProduct(product.id, input);
                  toast.success("Product updated");
                  navigate({ to: "/admin/products" });
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Failed to update product",
                  );
                }
              }}
            />
          )}
        </main>
      </div>
    </RequireAdmin>
  );
}
