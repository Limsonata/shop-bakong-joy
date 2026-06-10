import { Link, useRouter } from "@tanstack/react-router";
import { Search, Menu, ShoppingBag, User, ArrowRight, Bell, Package, ShieldAlert, Tag, Info } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CartDrawer } from "@/components/site/CartDrawer";
import { Logo } from "@/components/site/Logo";
import { getCollections, getProductTypes } from "@/lib/localStore";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
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
    case "order_update": return <Package className={cn(cls, "text-blue-500")} />;
    case "admin_alert":  return <ShieldAlert className={cn(cls, "text-orange-500")} />;
    case "promotion":    return <Tag className={cn(cls, "text-green-500")} />;
    case "system":       return <Info className={cn(cls, "text-muted-foreground")} />;
  }
}

function NotificationBell({ userId }: { userId: string }) {
  const { data: notifications = [], unreadCount, markAsRead, markAllAsRead } =
    useNotifications(userId);

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
                    !n.read
                      ? "bg-muted/40 cursor-pointer hover:bg-muted/60"
                      : "hover:bg-muted/20",
                  )}
                >
                  {notifIcon(n.type)}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{formatTimeAgo(n.created_at)}</p>
                  </div>
                  {!n.read && (
                    <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                  )}
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
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isLoading: authLoading } = useAuth();

  // Track scroll for glassmorphism effect
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled ? "liquid-glass border-b" : "bg-transparent"}`}
      >
        {/* Top Banner */}
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="bg-foreground text-background py-2 text-center text-xs font-medium tracking-wide"
        >
          <span className="inline-flex items-center gap-2">
            Free nationwide shipping in Cambodia
            <ArrowRight className="w-3 h-3" />
          </span>
        </motion.div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <motion.div whileHover={{ scale: 0.7 }} whileTap={{ scale: 0.6 }}>
              <Link to="/" className="flex items-center">
                <Logo className="h-8 w-auto" />
              </Link>
            </motion.div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              {([
                { to: "/" as const, label: "Home" },
                { to: "/shop" as const, label: "Shop" },
              ]).map((item, index) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + index * 0.1 }}
                >
                  <Link
                    to={item.to}
                    className="relative text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2 group"
                  >
                    {item.label}
                    <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-foreground transition-all group-hover:w-full" />
                  </Link>
                </motion.div>
              ))}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <NavigationMenu>
                  <NavigationMenuList>
                    <NavigationMenuItem>
                      <NavigationMenuTrigger className="h-auto bg-transparent px-0 py-2 text-sm font-medium text-muted-foreground hover:bg-transparent hover:text-foreground data-[state=open]:bg-transparent data-[state=open]:text-foreground focus:bg-transparent">
                        Collections
                      </NavigationMenuTrigger>
                      <NavigationMenuContent>
                        <div className="grid grid-cols-2 gap-8 p-6 w-[400px]">
                          {collectionsData && collectionsData.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                                Collections
                              </h4>
                              <ul className="space-y-1">
                                {collectionsData.slice(0, 6).map((collection) => (
                                  <li key={collection.node.id}>
                                    <button
                                      onClick={() =>
                                        router.navigate({
                                          to: "/shop",
                                          search: { q: collection.node.title },
                                        })
                                      }
                                      className="text-sm text-foreground hover:text-primary transition-colors py-1"
                                    >
                                      {collection.node.title}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {productTypes.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                                Product Types
                              </h4>
                              <ul className="space-y-1">
                                {productTypes.slice(0, 6).map((type) => (
                                  <li key={type}>
                                    <button
                                      onClick={() =>
                                        router.navigate({ to: "/shop", search: { q: type } })
                                      }
                                      className="text-sm text-foreground hover:text-primary transition-colors py-1"
                                    >
                                      {type}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </NavigationMenuContent>
                    </NavigationMenuItem>
                  </NavigationMenuList>
                </NavigationMenu>
              </motion.div>
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Account */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                {authLoading ? (
                  <div className="h-9 w-9" />
                ) : user ? (
                  <Button asChild variant="ghost" size="icon">
                    <Link to="/account">
                      <User className="h-5 w-5" />
                    </Link>
                  </Button>
                ) : (
                  <Button asChild variant="ghost" size="sm" className="hidden md:flex">
                    <Link to="/login">Sign In</Link>
                  </Button>
                )}
              </motion.div>

              {/* Notifications */}
              {!authLoading && user && isSupabaseConfigured && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.55 }}
                >
                  <NotificationBell userId={user.id} />
                </motion.div>
              )}

              {/* Cart */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <CartDrawer />
              </motion.div>

              {/* Mobile Menu */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full pt-16 sm:max-w-sm">
                  <SheetHeader className="sr-only">
                    <SheetTitle>Navigation</SheetTitle>
                  </SheetHeader>
                  <div className="overflow-auto h-full pb-6">
                    <form onSubmit={onSearch} className="mb-8">
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                          value={q}
                          onChange={(e) => setQ(e.target.value)}
                          placeholder="Search products..."
                          className="pl-12 py-6 text-lg rounded-full"
                        />
                      </div>
                    </form>
                    <nav className="space-y-2">
                      {([
                        { label: "Home", to: "/" as const },
                        { label: "Shop", to: "/shop" as const },
                        { label: "Orders", to: "/orders" as const },
                        { label: "Account", to: "/account" as const },
                      ]).map((item) => (
                        <Link
                          key={item.label}
                          to={item.to}
                          onClick={() => setMobileMenuOpen(false)}
                          className="block py-4 text-2xl font-medium border-b border-border hover:pl-4 transition-all"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </nav>
                    {!user && (
                      <div className="mt-8">
                        <Button asChild className="w-full py-6 text-lg rounded-full">
                          <Link to="/login">Sign In</Link>
                        </Button>
                      </div>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Spacer for fixed header */}
      <div className="h-[72px]" />
    </>
  );
}

