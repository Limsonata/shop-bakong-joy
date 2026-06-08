import { Link, useRouter } from "@tanstack/react-router";
import { Search, Menu, X, ChevronDown, User } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { CartDrawer } from "@/components/site/CartDrawer";
import { getCollections, getProductTypes } from "@/lib/localStore";
import { useAuth } from "@/hooks/useAuth";

export function Navbar() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const { user, isLoading: authLoading } = useAuth();

  // Fetch collections
  const { data: collectionsData } = useQuery({
    queryKey: ["collections"],
    queryFn: () => getCollections({ first: 20 }),
  });

  // Fetch product types
  const { data: productTypes = [] } = useQuery({
    queryKey: ["productTypes"],
    queryFn: () => getProductTypes(),
  });

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.navigate({ to: "/shop", search: { q } });
  };

  const handleCategoryClick = (type: string) => {
    router.navigate({ to: "/shop", search: { q: type } });
    setCategoriesOpen(false);
    setOpen(false);
  };

  const nav = [
    { to: "/", label: "Home" },
    { to: "/shop", label: "Shop" },
  ] as const;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background font-bold">
            S
          </div>
          <span className="text-lg font-semibold tracking-tight">Storefront</span>
        </Link>

        <nav className="ml-6 hidden items-center gap-1 md:flex">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              {n.label}
            </Link>
          ))}

          <NavigationMenu>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger className="h-auto rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
                  Categories
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                    {collectionsData && collectionsData.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold">Collections</h4>
                        <ul className="space-y-1">
                          {collectionsData.map((collection) => (
                            <li key={collection.node.id}>
                              <NavigationMenuLink asChild>
                                <button
                                  onClick={() => handleCategoryClick(collection.node.title)}
                                  className="block w-full rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                >
                                  {collection.node.title}
                                </button>
                              </NavigationMenuLink>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {productTypes.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold">Product Types</h4>
                        <ul className="space-y-1">
                          {productTypes.map((type) => (
                            <li key={type}>
                              <NavigationMenuLink asChild>
                                <button
                                  onClick={() => handleCategoryClick(type)}
                                  className="block w-full rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                >
                                  {type}
                                </button>
                              </NavigationMenuLink>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {(!collectionsData || collectionsData.length === 0) &&
                      productTypes.length === 0 && (
                        <div className="col-span-2 py-6 text-center text-sm text-muted-foreground">
                          No categories available
                        </div>
                      )}
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </nav>

        <form onSubmit={onSearch} className="ml-auto hidden flex-1 max-w-sm md:block">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products..."
              className="pl-9"
            />
          </div>
        </form>

        <div className="ml-auto flex items-center gap-1 md:ml-2">
          {authLoading ? (
            <div className="hidden h-8 w-14 md:block" aria-hidden="true" />
          ) : user ? (
            <Button asChild variant="ghost" size="icon" title={user.name}>
              <Link to="/account">
                <User className="h-5 w-5" />
              </Link>
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm" className="hidden md:flex">
              <Link to="/login">Login</Link>
            </Button>
          )}
          <CartDrawer />
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(!open)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {open && (
        <div className="border-t md:hidden">
          <div className="mx-auto max-w-7xl space-y-1 px-4 py-3">
            <form onSubmit={onSearch}>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search products..."
                  className="pl-9"
                />
              </div>
            </form>
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="block rounded-md px-3 py-2 text-sm hover:bg-accent"
              >
                {n.label}
              </Link>
            ))}

            {/* Mobile Categories */}
            <div className="space-y-1">
              <button
                onClick={() => setCategoriesOpen(!categoriesOpen)}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-accent"
              >
                Categories
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${categoriesOpen ? "rotate-180" : ""}`}
                />
              </button>

              {categoriesOpen && (
                <div className="space-y-1 pl-3">
                  {collectionsData && collectionsData.length > 0 && (
                    <div className="space-y-1">
                      <p className="px-3 py-1 text-xs font-semibold text-muted-foreground">
                        Collections
                      </p>
                      {collectionsData.map((collection) => (
                        <button
                          key={collection.node.id}
                          onClick={() => handleCategoryClick(collection.node.title)}
                          className="block w-full rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent"
                        >
                          {collection.node.title}
                        </button>
                      ))}
                    </div>
                  )}

                  {productTypes.length > 0 && (
                    <div className="space-y-1">
                      <p className="px-3 py-1 text-xs font-semibold text-muted-foreground">
                        Product Types
                      </p>
                      {productTypes.map((type) => (
                        <button
                          key={type}
                          onClick={() => handleCategoryClick(type)}
                          className="block w-full rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent"
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
