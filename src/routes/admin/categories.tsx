import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, FileJson, Tags } from "lucide-react";
import { RequireAdmin } from "@/components/admin/RequireAdmin";

export const Route = createFileRoute("/admin/categories")({
  head: () => ({ meta: [{ title: "Collections - Admin" }] }),
  component: CategoriesAdmin,
});

function CategoriesAdmin() {
  return (
    <RequireAdmin>
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6">
            <div className="flex items-center gap-4">
              <Link to="/admin" className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-xl font-semibold">Collections</h1>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <Card>
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                <Tags className="h-5 w-5 text-primary" />
              </div>
              <CardTitle>Manage collections in app data</CardTitle>
              <CardDescription>
                Collections and product organization are read from the local product data file.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <FileJson className="h-4 w-4 text-muted-foreground" />
                <code>src/data/products.json</code>
              </div>
              <Button asChild variant="outline">
                <Link to="/admin/settings">View store settings</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    </RequireAdmin>
  );
}
