import { Link, useRouter } from "@tanstack/react-router";
import { Search, Menu, X, ShoppingBag, User, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CartDrawer } from "@/components/site/CartDrawer";
import { Logo } from "@/components/site/Logo";
import { getCollections, getProductTypes } from "@/lib/localStore";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";

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

  const navItems = [
    { to: "/", label: "Home" },
    { to: "/shop", label: "Shop" },
    { to: "/shop", label: "Collections", isDropdown: true },
  ];

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
              {navItems.map((item, index) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + index * 0.1 }}
                >
                  {item.isDropdown ? (
                    <DropdownNav
                      label={item.label}
                      collections={collectionsData}
                      productTypes={productTypes}
                      router={router}
                    />
                  ) : (
                    <Link
                      to={item.to}
                      className="relative text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2 group"
                    >
                      {item.label}
                      <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-foreground transition-all group-hover:w-full" />
                    </Link>
                  )}
                </motion.div>
              ))}
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

              {/* Cart */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <CartDrawer />
              </motion.div>

              {/* Mobile Menu Toggle */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <motion.div
                  animate={{ rotate: mobileMenuOpen ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </motion.div>
              </Button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-40 bg-background md:hidden"
          >
            <div className="pt-20 px-6 pb-6 h-full overflow-auto">
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
                {[
                  { label: "Home", to: "/" },
                  { label: "Shop", to: "/shop" },
                  { label: "Orders", to: "/orders" },
                  { label: "Account", to: "/account" },
                ].map((item, i) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <Link
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className="block py-4 text-2xl font-medium border-b border-border hover:pl-4 transition-all"
                    >
                      {item.label}
                    </Link>
                  </motion.div>
                ))}
              </nav>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-8"
              >
                {!user && (
                  <Button asChild className="w-full py-6 text-lg rounded-full">
                    <Link to="/login">Sign In</Link>
                  </Button>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spacer for fixed header */}
      <div className="h-[72px]" />
    </>
  );
}

// Dropdown Navigation Component
function DropdownNav({
  label,
  collections,
  productTypes,
  router,
}: {
  label: string;
  collections?: { node: { id: string; title: string } }[];
  productTypes: string[];
  router: ReturnType<typeof useRouter>;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const handleClick = (type: string) => {
    router.navigate({ to: "/shop", search: { q: type } });
    setIsOpen(false);
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2">
        {label}
        <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          ▼
        </motion.span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 pt-2"
          >
            <div className="bg-card rounded-2xl shadow-2xl border p-6 min-w-[400px]">
              <div className="grid grid-cols-2 gap-8">
                {collections && collections.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                      Collections
                    </h4>
                    <ul className="space-y-1">
                      {collections.slice(0, 6).map((collection) => (
                        <li key={collection.node.id}>
                          <button
                            onClick={() => handleClick(collection.node.title)}
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
                            onClick={() => handleClick(type)}
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
