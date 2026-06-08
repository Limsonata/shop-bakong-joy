import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { RequireAdmin } from "@/components/admin/RequireAdmin";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [{ title: "Settings - Admin" }] }),
  component: SettingsAdmin,
});

function SettingsAdmin() {
  return (
    <RequireAdmin>
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6">
            <div className="flex items-center gap-4">
              <Link to="/admin" className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-xl font-semibold">Settings</h1>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Store Information</CardTitle>
                <CardDescription>Basic store configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium">Store Name</p>
                  <p className="text-sm text-muted-foreground">Shop Bakong Joy</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Currency</p>
                  <p className="text-sm text-muted-foreground">USD</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Data Location</p>
                  <p className="text-sm text-muted-foreground">
                    <code>src/data/products.json</code>
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Admin Access</CardTitle>
                <CardDescription>Security settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium">Default Password</p>
                  <p className="text-sm text-muted-foreground">
                    <code>admin123</code>
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Change in <code>src/routes/admin/login.tsx</code>
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment Platform</CardTitle>
                <CardDescription>Bakong payment configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium">Service</p>
                  <p className="text-sm text-muted-foreground">Bakong / KHQR</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Merchant Account</p>
                  <p className="text-sm text-muted-foreground">
                    <code>VITE_BAKONG_MERCHANT_ACCOUNT</code>
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">QR Image URL</p>
                  <p className="text-sm text-muted-foreground">
                    <code>VITE_BAKONG_QR_IMAGE_URL</code>
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Documentation</CardTitle>
                <CardDescription>Helpful resources</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">README.md</span>
                  <Button asChild variant="ghost" size="sm">
                    <a href="/README.md" target="_blank">
                      View
                    </a>
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">How to Add Products</span>
                  <Button asChild variant="ghost" size="sm">
                    <a href="/HOW-TO-ADD-PRODUCTS.md" target="_blank">
                      View
                    </a>
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Cloudinary Setup</span>
                  <Button asChild variant="ghost" size="sm">
                    <a href="/CLOUDINARY-SETUP.md" target="_blank">
                      View
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Important Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>• Products and collections are managed in app data</p>
                <p>• Checkout uses a Bakong payment confirmation flow</p>
                <p>• The admin panel is password protected (default: admin123)</p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </RequireAdmin>
  );
}
