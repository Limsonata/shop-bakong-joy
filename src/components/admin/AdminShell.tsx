import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Boxes,
  LayoutDashboard,
  MessageSquare,
  Package,
  Palette,
  Receipt,
  ScrollText,
  Settings,
  ShoppingCart,
  FileText,
  Truck,
} from "lucide-react";
import { logout } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { usingLocalOnly } from "@/lib/pos/store";

/**
 * Admin navigation grouped so it is easy to scan:
 * - Selling: things you do every day (dashboard, record a sale, online orders)
 * - Shop: what you sell (products, categories, stock)
 * - Money: money in and out (sales history, expenses, reports)
 * - Website: the public site (content, customer feedback, settings)
 */
const NAV_GROUPS = [
  {
    label: "Selling",
    items: [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { to: "/admin/pos", label: "New sale (in store)", icon: ShoppingCart },
      { to: "/admin/orders", label: "Orders (online)", icon: Truck },
    ],
  },
  {
    label: "Shop",
    items: [
      { to: "/admin/products", label: "Products", icon: Package },
      { to: "/admin/categories", label: "Categories", icon: Palette },
      { to: "/admin/inventory", label: "Stock", icon: Boxes },
    ],
  },
  {
    label: "Money",
    items: [
      { to: "/admin/sales", label: "Sales", icon: Receipt },
      { to: "/admin/finance", label: "Money", icon: ScrollText },
      { to: "/admin/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    label: "Website",
    items: [
      { to: "/admin/content", label: "Content", icon: FileText },
      { to: "/admin/feedback", label: "Feedback", icon: MessageSquare },
      { to: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
] as const;

/**
 * Shared chrome for every admin page: role guard, top navigation and the
 * "data is only on this device" warning when Supabase is not connected.
 */
export function AdminShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const handleLogout = async () => {
    await logout();
    window.location.href = "/admin/login";
  };

  return (
    <RequireAdmin>
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <img src="/Billie.svg" alt="BillieGrace Closet" className="h-9 w-auto" />
              <div>
                <h1 className="text-lg font-semibold leading-tight">{title}</h1>
                {description ? (
                  <p className="text-sm text-muted-foreground">{description}</p>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {actions}
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>

          <nav aria-label="Admin sections" className="mx-auto max-w-7xl px-2 pb-2 sm:px-4">
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {NAV_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {group.label}
                  </p>
                  <ul className="flex flex-wrap gap-1">
                    {group.items.map((item) => {
                      const active =
                        item.to === "/admin"
                          ? pathname === "/admin"
                          : pathname.startsWith(item.to);
                      const Icon = item.icon;
                      return (
                        <li key={item.to}>
                          <Link
                            to={item.to}
                            aria-current={active ? "page" : undefined}
                            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                              active
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                          >
                            <Icon className="h-4 w-4" aria-hidden="true" />
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </nav>
        </header>

        {usingLocalOnly ? (
          <div className="border-b bg-amber-50 text-amber-900">
            <p className="mx-auto max-w-7xl px-4 py-2 text-xs sm:px-6">
              Offline mode — stock, sales and money are saved in this browser only. Connect Supabase
              for cloud sync, and use{" "}
              <Link to="/admin/reports" className="font-medium underline">
                Reports → Backup
              </Link>{" "}
              regularly.
            </p>
          </div>
        ) : null}

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
      </div>
    </RequireAdmin>
  );
}
