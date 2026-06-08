import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { ProductForm } from "@/components/admin/ProductForm";
import { createProduct } from "@/lib/productStore";

export const Route = createFileRoute("/admin/products/new")({
  head: () => ({ meta: [{ title: "New Product - Admin" }] }),
  component: NewProductPage,
});

function NewProductPage() {
  const navigate = useNavigate();

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
              <h1 className="text-xl font-semibold">New Product</h1>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <ProductForm
            submitLabel="Create product"
            onSubmit={async (input) => {
              try {
                await createProduct(input);
                toast.success(`Created "${input.title}"`);
                navigate({ to: "/admin/products" });
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "Failed to create product",
                );
              }
            }}
          />
        </main>
      </div>
    </RequireAdmin>
  );
}
