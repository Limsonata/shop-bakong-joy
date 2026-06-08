import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { login } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Login - Shop Bakong Joy" }] }),
  component: SimpleLoginPage,
});

function SimpleLoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const result = await login(email, password);

    if (result.success && result.user) {
      toast.success(`Welcome back, ${result.user.name}!`);
      const redirectTo = result.user.role === "admin" ? "/admin" : "/";
      // Small delay so the toast is visible before navigation
      setTimeout(() => {
        window.location.href = redirectTo;
      }, 600);
    } else {
      toast.error(result.error || "Login failed");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground text-xl font-bold text-background">
            S
          </div>
          <CardTitle>Login</CardTitle>
          <CardDescription>Enter your credentials to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </form>

          {!isSupabaseConfigured && (
            <div className="mt-6 rounded-lg border bg-muted p-4">
              <p className="text-sm font-semibold">Demo Mode</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Configure Supabase to enable real accounts. Use these test accounts for now:
              </p>
              <div className="mt-2 space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Admin Account:</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-1"
                    onClick={() => {
                      setEmail("admin@shop.com");
                      setPassword("admin123");
                    }}
                  >
                    Fill Admin
                  </Button>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">User Account:</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-1"
                    onClick={() => {
                      setEmail("user@shop.com");
                      setPassword("user123");
                    }}
                  >
                    Fill User
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <a href="/admin/login" className="text-primary hover:underline">
                Register here
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
