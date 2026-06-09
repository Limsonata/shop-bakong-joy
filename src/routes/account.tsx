import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { User, ShoppingBag, LogOut, Shield } from "lucide-react";
import { useEffect } from "react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "My Account — Shop Bakong Joy" }] }),
  component: AccountPage,
});

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] },
};

function AccountPage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate({ to: "/login", replace: true });
    }
  }, [isLoading, user, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate({ to: "/" });
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="mx-auto max-w-4xl px-4 py-12 sm:px-6"
    >
      <motion.div {...fadeUp} className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">My Account</h1>
        <p className="mt-2 text-muted-foreground">Manage your account and preferences</p>
      </motion.div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Profile */}
        <motion.div
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.05 }}
          className="liquid-glass-card rounded-2xl p-6 space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/8 border border-border">
              <User className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <p className="font-semibold">Profile</p>
              <p className="text-sm text-muted-foreground">Your account information</p>
            </div>
          </div>
          <div className="space-y-3 pt-2">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Name</p>
              <p className="font-medium mt-0.5">{user.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Email</p>
              <p className="font-medium mt-0.5">{user.email}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Role</p>
              <div className="flex items-center gap-2 mt-0.5">
                {user.role === "admin" && <Shield className="h-3.5 w-3.5 text-accent" />}
                <p className="font-medium capitalize">{user.role}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Orders */}
        <motion.div
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.1 }}
          className="liquid-glass-card rounded-2xl p-6 space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/8 border border-border">
              <ShoppingBag className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <p className="font-semibold">Orders</p>
              <p className="text-sm text-muted-foreground">View your order history</p>
            </div>
          </div>
          <div className="space-y-2 pt-2">
            <Button asChild className="w-full rounded-full">
              <Link to="/orders">View My Orders</Link>
            </Button>
            <Button asChild className="w-full rounded-full" variant="outline">
              <Link to="/shop">Continue Shopping</Link>
            </Button>
          </div>
        </motion.div>

        {/* Admin */}
        {user.role === "admin" && (
          <motion.div
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.15 }}
            className="liquid-glass-card rounded-2xl p-6 space-y-4 md:col-span-2"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 border border-border">
                <Shield className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="font-semibold">Admin Access</p>
                <p className="text-sm text-muted-foreground">Manage your store</p>
              </div>
            </div>
            <Button asChild className="w-full rounded-full">
              <Link to="/admin">Go to Admin Dashboard</Link>
            </Button>
          </motion.div>
        )}

        {/* Logout */}
        <motion.div
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.2 }}
          className="liquid-glass-card rounded-2xl p-6 space-y-4 md:col-span-2"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 border border-border">
              <LogOut className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="font-semibold">Sign out</p>
              <p className="text-sm text-muted-foreground">Sign out of your account</p>
            </div>
          </div>
          <Button onClick={handleLogout} variant="destructive" className="w-full rounded-full">
            Logout
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
