import { useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
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
  LogOut,
  Menu,
  Store,
} from "lucide-react";
import { logout } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { usingLocalOnly } from "@/lib/pos/store";
import { SidebarNav, type NavGroupData, type NavItemData } from "@/components/ui/dashboard-sidebar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

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
      { to: "/admin/finance", label: "Cash book", icon: ScrollText },
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

const SIDEBAR_GROUPS: NavGroupData[] = NAV_GROUPS.map((group, index) => ({
  heading: index === 0 ? undefined : group.label,
  items: group.items.map((item) => ({ id: item.to, title: item.label, icon: item.icon })),
}));

const SIDEBAR_BOTTOM_ITEMS: NavItemData[] = [
  { id: "__shop", title: "View shop", icon: Store },
  { id: "__logout", title: "Log out", icon: LogOut },
];

/** The sidebar item that matches the current URL (longest match wins). */
function activeIdForPath(pathname: string): string {
  const ids = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.to as string));
  const matches = ids.filter((id) =>
    id === "/admin" ? pathname === "/admin" : pathname === id || pathname.startsWith(`${id}/`),
  );
  return matches.sort((a, b) => b.length - a.length)[0] ?? "";
}

function SidebarHeader() {
  return (
    <div className="mb-4 flex items-center gap-3 px-2 py-2">
      <img src="/Billie.svg" alt="BillieGrace Closet" className="h-8 w-auto shrink-0" />
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Admin
      </span>
    </div>
  );
}

/**
 * Shared chrome for every admin page: role guard, sidebar navigation (a drawer on
 * phones) and the "data is only on this device" warning when Supabase is not connected.
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
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    window.location.href = "/admin/login";
  };

  const handleSelect = (id: string) => {
    setMenuOpen(false);
    if (id === "__logout") {
      void handleLogout();
    } else if (id === "__shop") {
      void navigate({ to: "/" });
    } else {
      void navigate({ to: id });
    }
  };

  const sidebar = (
    <SidebarNav
      className="w-full border-none bg-transparent"
      groups={SIDEBAR_GROUPS}
      bottomItems={SIDEBAR_BOTTOM_ITEMS}
      header={<SidebarHeader />}
      activeId={activeIdForPath(pathname)}
      onSelect={handleSelect}
    />
  );

  return (
    <RequireAdmin>
      <div className="min-h-screen bg-background lg:flex">
        {/* Desktop: fixed sidebar */}
        <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 border-r border-border/50 bg-card/50 lg:block">
          {sidebar}
        </aside>

        <div className="min-w-0 flex-1">
          <header className="border-b pt-[env(safe-area-inset-top)]">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                {/* Phones and tablets: sidebar opens as a drawer */}
                <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 lg:hidden"
                      aria-label="Open admin menu"
                    >
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[280px] p-0 sm:max-w-[280px]">
                    <SheetHeader className="sr-only">
                      <SheetTitle>Admin navigation</SheetTitle>
                    </SheetHeader>
                    {sidebar}
                  </SheetContent>
                </Sheet>
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-semibold leading-tight">{title}</h1>
                  {description ? (
                    <p className="hidden text-sm text-muted-foreground sm:block">{description}</p>
                  ) : null}
                </div>
              </div>
              {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
            </div>
          </header>

          {usingLocalOnly ? (
            <div className="border-b bg-amber-50 text-amber-900">
              <p className="mx-auto max-w-7xl px-4 py-2 text-xs sm:px-6">
                Offline mode — stock, sales and money are saved in this browser only. Connect
                Supabase for cloud sync, and use{" "}
                <Link to="/admin/reports" className="font-medium underline">
                  Reports → Backup
                </Link>{" "}
                regularly.
              </p>
            </div>
          ) : null}

          <main className="mx-auto min-w-0 max-w-7xl overflow-x-clip px-4 py-6 sm:px-6">
            {children}
          </main>
        </div>
      </div>
    </RequireAdmin>
  );
}
