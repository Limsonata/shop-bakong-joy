import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Package, Store, User } from "lucide-react";

const TABS = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/shop", label: "Shop", icon: Store, exact: false },
  { to: "/orders", label: "Orders", icon: Package, exact: false },
  { to: "/account", label: "Account", icon: User, exact: false },
] as const;

/** App-style bottom navigation, phones only. */
export function MobileTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Checkout needs the whole screen; its own button is the next step.
  if (pathname.startsWith("/checkout")) return null;

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-4">
        {TABS.map(({ to, label, icon: Icon, exact }) => {
          const active = exact ? pathname === to : pathname.startsWith(to);
          return (
            <li key={to}>
              <Link
                to={to}
                aria-current={active ? "page" : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] transition-colors ${
                  active ? "font-semibold text-foreground" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.6} aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
