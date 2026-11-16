import { Link, useRouter } from "@tanstack/react-router";
import { Search, Menu, User, Bell, Package, ShieldAlert, Tag, Info, X, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CartDrawer } from "@/components/site/CartDrawer";
import { Logo } from "@/components/site/Logo";
import { getCollections, getProductTypes } from "@/lib/productStore";
import { useAuth } from "@/hooks/useAuth";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { isSupabaseConfigured } from "@/lib/supabase";

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function notifIcon(type: Notification["type"]) {
  const cls = "h-4 w-4 shrink-0 mt-0.5";
  switch (type) {
    case "order_update":
      return <Package className={cn(cls, "text-blue-500")} />;
    case "admin_alert":
      return <ShieldAlert className={cn(cls, "text-orange-500")} />;
    case "promotion":
      return <Tag className={cn(cls, "text-green-500")} />;
    case "system":
      return <Info className={cn(cls, "text-muted-foreground")} />;
  }
}

function NotificationBell({ userId }: { userId: string }) {
  const {
    data: notifications = [],
    unreadCount,
    markAsRead,
    markAllAsRead,
  } = useNotifications(userId);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold text-sm">Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllAsRead.mutate()}
              disabled={markAllAsRead.isPending}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              Mark all read
            </button>
          )}
        </div>
        <ScrollArea className="h-[320px]">
          {notifications.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            <ul>
              {notifications.map((n) => (
                <li
                  key={n.id}
                  onClick={() => !n.read && markAsRead.mutate(n.id)}
                  className={cn(
                    "flex gap-3 px-4 py-3 border-b last:border-0 transition-colors",
                    !n.read ? "bg-muted/40 cursor-pointer hover:bg-muted/60" : "hover:bg-muted/20",
                  )}
                >
                  {notifIcon(n.type)}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatTimeAgo(n.created_at)}
                    </p>
                  </div>
                  {!n.read && <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />}
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export function Navbar() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isLoading: authLoading } = useAuth();

  // Fetch collections and product types
  const { data: collectionsData } = useQuery({
    queryKey: ["collections"],
    queryFn: () => getCollections({ first: 20 }),
  });

  const { data: productTypes = [] } = useQuery({
    queryKey: ["productTypes"],
    queryFn: () => getProductTypes(),
  });

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.navigate({ to: "/shop", search: { q } });
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/70 pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-saturate-150 md:bg-background md:backdrop-blur-none">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <div className="flex h-14 items-center justify-between gap-6">
          {/* Logo */}
          <Link
            to="/"
            className="flex shrink-0 items-center"
            aria-label="BillieGrace Closet — home"
          >
            <Logo className="h-9 w-auto" />
          </Link>

          {/* Desktop Navigation — quiet uppercase editorial links */}
          <nav className="hidden items-center gap-7 lg:flex">
            <NavigationMenu>
              <NavigationMenuList className="gap-7">
                {/* Shop dropdown */}
                <NavigationMenuItem>
                  <NavigationMenuTrigger
                    className="editorial-label h-auto w-auto gap-1.5 bg-transparent px-0 py-2 text-foreground
                        hover:bg-transparent data-[state=open]:bg-transparent focus:bg-transparent
                        [&>svg]:h-3 [&>svg]:w-3"
                  >
                    Shop
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <div className="w-[240px] p-8">
                      {productTypes.length > 0 && (
                        <div>
                          <p className="editorial-label mb-4 text-muted-foreground">Categories</p>
                          <ul className="space-y-2.5">
                            {productTypes.slice(0, 8).map((type) => (
                              <li key={type}>
                                <button
                                  onClick={() =>
                                    router.navigate({ to: "/shop", search: { q: type } })
                                  }
                                  className="text-sm font-light text-foreground transition-opacity hover:opacity-60"
                                >
                                  {type}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <Link to="/shop" className="editorial-label mt-6 inline-block">
                        View All
                      </Link>
                    </div>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                {/* Collections dropdown */}
                {collectionsData && collectionsData.length > 0 && (
                  <NavigationMenuItem>
                    <NavigationMenuTrigger
                      className="editorial-label h-auto w-auto gap-1.5 bg-transparent px-0 py-2 text-foreground
                          hover:bg-transparent data-[state=open]:bg-transparent focus:bg-transparent
                          [&>svg]:h-3 [&>svg]:w-3"
                    >
                      Collections
                    </NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <div className="w-[240px] p-8">
                        <p className="editorial-label mb-4 text-muted-foreground">Collections</p>
                        <ul className="space-y-2.5">
                          {collectionsData.slice(0, 8).map((collection) => (
                            <li key={collection.node.id}>
                              <button
                                onClick={() =>
                                  router.navigate({
                                    to: "/shop",
                                    search: { q: collection.node.title },
                                  })
                                }
                                className="text-sm font-light text-foreground transition-opacity hover:opacity-60"
                              >
                                {collection.node.title}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                )}
              </NavigationMenuList>
            </NavigationMenu>

            {[
              { label: "New In", search: "New Arrivals" },
              { label: "Sets", search: "Sets" },
              { label: "Sale", search: "Sale" },
            ].map((item) => (
              <Link
                key={item.label}
                to="/shop"
                search={{ q: item.search }}
                className="editorial-label transition-opacity hover:opacity-60"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {/* Search */}
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Search"
                  className="hidden md:inline-flex"
                >
                  <Search className="h-[18px] w-[18px]" strokeWidth={1.5} />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-4">
                <form
                  onSubmit={(e) => {
                    onSearch(e);
                    setSearchOpen(false);
                  }}
                  className="flex items-center gap-3 border-b border-border pb-2"
                >
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input
                    autoFocus
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search products..."
                    aria-label="Search products"
                    className="editorial-input w-full bg-transparent py-1 text-sm"
                  />
                </form>
              </PopoverContent>
            </Popover>

            {/* Account */}
            {authLoading ? (
              <div className="h-9 w-9" />
            ) : user ? (
              <Button asChild variant="ghost" size="icon" aria-label="Account">
                <Link to="/account">
                  <User className="h-[18px] w-[18px]" strokeWidth={1.5} />
                </Link>
              </Button>
            ) : (
              <Button asChild variant="ghost" size="icon" aria-label="Sign in">
                <Link to="/login">
                  <User className="h-[18px] w-[18px]" strokeWidth={1.5} />
                </Link>
              </Button>
            )}

            {/* Notifications */}
            {!authLoading && user && isSupabaseConfigured && <NotificationBell userId={user.id} />}

            {/* Cart */}
            <CartDrawer />

            {/* Mobile Menu — full-height sheet */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open menu"
                  className="md:hidden"
                >
                  <Menu className="h-5 w-5" strokeWidth={1.5} />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="flex w-full max-w-none flex-col gap-0 border-0 bg-white p-0 text-black sm:max-w-none [&>button]:hidden"
              >
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <SheetDescription className="sr-only">Site navigation menu</SheetDescription>

                <div className="flex h-14 shrink-0 items-center justify-between border-b border-black/10 px-4 pt-[env(safe-area-inset-top)] box-content">
                  <Logo className="h-9 w-auto" />
                  <SheetClose asChild>
                    <Button variant="ghost" size="icon" aria-label="Close menu">
                      <X className="h-5 w-5" strokeWidth={1.5} />
                    </Button>
                  </SheetClose>
                </div>

                <div className="flex-1 overflow-y-auto px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6">
                  <form onSubmit={(e) => { onSearch(e); setMobileMenuOpen(false); }}>
                    <div className="flex items-center gap-3 border-b border-black/30 pb-3 focus-within:border-black">
                      <Search className="h-5 w-5 shrink-0" strokeWidth={1.5} />
                      <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search products"
                        aria-label="Search products"
                        className="w-full bg-transparent text-base font-light placeholder:text-black/40 focus:outline-none"
                      />
                    </div>
                  </form>

                  <nav className="mt-6" aria-label="Mobile">
                    {[
                      { label: "Home", to: "/" as const, search: undefined },
                      { label: "Shop", to: "/shop" as const, search: undefined },
                      { label: "New Arrivals", to: "/shop" as const, search: { q: "New Arrivals" } },
                      { label: "Sets", to: "/shop" as const, search: { q: "Sets" } },
                      { label: "Activewear", to: "/shop" as const, search: { q: "Activewear" } },
                      { label: "Sale", to: "/shop" as const, search: { q: "Sale" } },
                    ].map((item) => (
                      <Link
                        key={item.label}
                        to={item.to}
                        search={item.search}
                        onClick={() => setMobileMenuOpen(false)}
                        className="group flex items-center justify-between border-b border-black/10 py-4 text-[28px] font-light leading-none active:opacity-60"
                        style={{ fontFamily: "var(--font-serif)" }}
                      >
                        {item.label}
                        <ArrowRight
                          className="h-5 w-5 opacity-40 transition-transform group-active:translate-x-1"
                          strokeWidth={1.5}
                        />
                      </Link>
                    ))}
                  </nav>

                  {productTypes.length > 0 && (
                    <div className="mt-8">
                      <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.25em]">
                        Categories
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {productTypes.slice(0, 8).map((type) => (
                          <Link
                            key={type}
                            to="/shop"
                            search={{ q: type }}
                            onClick={() => setMobileMenuOpen(false)}
                            className="rounded-full border border-black/20 px-4 py-2 text-[13px] font-light active:bg-black active:text-white"
                          >
                            {type}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-8 grid grid-cols-2 gap-3">
                    <Link
                      to="/orders"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center justify-center gap-2 rounded-full border border-black/20 py-3 text-[12px] uppercase tracking-[0.2em] active:bg-black/5"
                    >
                      <Package className="h-4 w-4" strokeWidth={1.5} /> Orders
                    </Link>
                    <Link
                      to={user ? "/account" : "/login"}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center justify-center gap-2 rounded-full bg-black py-3 text-[12px] uppercase tracking-[0.2em] text-white active:opacity-80"
                    >
                      <User className="h-4 w-4" strokeWidth={1.5} /> {user ? "Account" : "Sign in"}
                    </Link>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
