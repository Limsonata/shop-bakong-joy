import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { logout } from "@/lib/auth";
import { RequireAdmin } from "@/components/admin/RequireAdmin";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin Dashboard" }] }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const handleLogout = async () => {
    await logout();
    window.location.href = "/admin/login";
  };

  return (
    <RequireAdmin>
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
            <h1 className="text-xl font-semibold">Admin Dashboard</h1>
            <Button variant="outline" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Products</CardTitle>
                <CardDescription>Manage your product catalog</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <a href="/admin/products">Manage Products</a>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Orders</CardTitle>
                <CardDescription>Track and fulfill customer orders</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <a href="/admin/orders">View Orders</a>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Categories</CardTitle>
                <CardDescription>Organize your collections</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <a href="/admin/categories">Manage Categories</a>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Settings</CardTitle>
                <CardDescription>Store configuration</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full" variant="outline">
                  <a href="/admin/settings">View Settings</a>
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle>How commerce works now</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold">Products and collections</h3>
                  <p className="text-sm text-muted-foreground">
                    Manage catalog data in the local product file. This storefront reads products,
                    variants, collections, pricing, and images from the app data layer.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold">Checkout</h3>
                  <p className="text-sm text-muted-foreground">
                    Cart actions keep items in the customer's browser and send them to a Bakong
                    payment checkout page.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold">Payments</h3>
                  <p className="text-sm text-muted-foreground">
                    Add your Bakong merchant account or KHQR image URL in environment settings to
                    accept real payments.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </RequireAdmin>
  );
}
