import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight, Sparkles, Truck, Shield, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductCard } from "@/components/site/ProductCard";
import { getProducts, getCollections } from "@/lib/localStore";
import { motion } from "framer-motion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "hairora — Premium Hair & Beauty" },
      {
        name: "description",
        content: "Discover curated everyday goods. Premium quality, thoughtful design.",
      },
      { property: "og:title", content: "Storefront" },
      { property: "og:description", content: "Modern essentials for everyday life." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Index,
});

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 40 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.23, 1, 0.32, 1] },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

function Index() {
  const { data: featuredProducts, isLoading } = useQuery({
    queryKey: ["products", "featured"],
    queryFn: () => getProducts({ first: 8 }),
  });

  const { data: collections } = useQuery({
    queryKey: ["collections"],
    queryFn: () => getCollections({ first: 6 }),
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen"
    >
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-background" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Left Content */}
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="text-center lg:text-left"
            >
              <motion.div
                {...fadeInUp}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6"
              >
                <Sparkles className="w-4 h-4" />
                New Collection 2025
              </motion.div>

              <motion.h1
                {...fadeInUp}
                className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold tracking-tight leading-[0.95]"
              >
                <span className="block text-foreground">Less,</span>
                <span className="block text-muted-foreground">
                  but
                  <span className="text-foreground ml-3 relative">
                    better
                    <svg
                      className="absolute -bottom-2 left-0 w-full"
                      viewBox="0 0 200 12"
                      fill="none"
                    >
                      <path
                        d="M2 8C50 2 150 2 198 8"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        className="text-primary"
                      />
                    </svg>
                  </span>
                </span>
              </motion.h1>

              <motion.p
                {...fadeInUp}
                className="mt-8 text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0"
              >
                Curated everyday goods designed with intention. Premium quality meets thoughtful
                minimalism.
              </motion.p>

              <motion.div
                {...fadeInUp}
                className="mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
              >
                <Button asChild size="lg" className="rounded-full px-8 py-6 text-lg group">
                  <Link to="/shop">
                    Shop Collection
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="rounded-full px-8 py-6 text-lg"
                >
                  <Link to="/shop">Explore</Link>
                </Button>
              </motion.div>

              {/* Stats */}
              <motion.div
                {...fadeInUp}
                className="mt-16 grid grid-cols-3 gap-8 max-w-md mx-auto lg:mx-0"
              >
                {[
                  ["10K+", "Products"],
                  ["50+", "Brands"],
                  ["99%", "Happy Customers"],
                ].map(([stat, label]) => (
                  <div key={label} className="text-center lg:text-left">
                    <div className="text-2xl font-bold text-foreground">{stat}</div>
                    <div className="text-sm text-muted-foreground">{label}</div>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            {/* Right - Hero Image Grid */}
            <motion.div
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.23, 1, 0.32, 1] }}
              className="relative hidden lg:block"
            >
              <div className="relative grid grid-cols-2 gap-4">
                <motion.div
                  initial={{ y: 40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                  className="space-y-4"
                >
                  <div className="aspect-[3/4] rounded-3xl overflow-hidden liquid-glass">
                    <img
                      src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&q=80"
                      alt="Minimal store interior"
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                    />
                  </div>
                  <div className="aspect-square rounded-3xl overflow-hidden liquid-glass">
                    <img
                      src="https://images.unsplash.com/photo-1556906781-9a412961c28c?w=600&q=80"
                      alt="Premium sneakers"
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                    />
                  </div>
                </motion.div>
                <motion.div
                  initial={{ y: -40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.5 }}
                  className="space-y-4 pt-12"
                >
                  <div className="aspect-square rounded-3xl overflow-hidden liquid-glass">
                    <img
                      src="https://images.unsplash.com/photo-1445205170230-053b83016050?w=600&q=80"
                      alt="Fashion collection"
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                    />
                  </div>
                  <div className="aspect-[4/3] rounded-3xl overflow-hidden liquid-glass">
                    <img
                      src="https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&q=80"
                      alt="Shopping experience"
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                    />
                  </div>
                </motion.div>
              </div>

              {/* Floating Badge */}
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ duration: 0.5, delay: 1 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 liquid-glass-card rounded-2xl p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full liquid-glass flex items-center justify-center">
                    <Shield className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Secure Payment</p>
                    <p className="text-xs text-muted-foreground">Bakong KHQR</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="border-y liquid-glass">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              ["Free Shipping", "On orders over $50", Truck],
              ["Secure Payment", "Bakong KHQR", Shield],
              ["Easy Returns", "30-day policy", RotateCcw],
            ].map(([title, desc, Icon], i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-4 justify-center"
              >
                <div className="w-12 h-12 rounded-full liquid-glass-card flex items-center justify-center">
                  <Icon className="w-5 h-5 text-foreground" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-foreground">{title}</p>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Collections Section */}
      {collections && collections.length > 0 && (
        <section className="py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex items-end justify-between mb-12"
            >
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Collections</h2>
                <p className="text-muted-foreground mt-2">Browse by category</p>
              </div>
              <Link
                to="/shop"
                className="hidden sm:flex items-center gap-1 text-sm font-medium hover:gap-2 transition-all"
              >
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {collections.slice(0, 6).map((collection, i) => (
                <motion.div
                  key={collection.node.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Link
                    to="/shop"
                    search={{ q: collection.node.title }}
                    className="group relative block aspect-square rounded-2xl overflow-hidden bg-muted"
                  >
                    <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.38)", backdropFilter: "blur(1px)", WebkitBackdropFilter: "blur(1px)" }} />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <p className="text-white font-medium">{collection.node.title}</p>
                    </div>
                    <ArrowUpRight className="absolute top-4 right-4 w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured Products */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex items-end justify-between mb-12"
          >
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Featured</h2>
              <p className="text-muted-foreground mt-2">Handpicked for you</p>
            </div>
            <Button asChild variant="ghost" className="hidden sm:flex">
              <Link to="/shop">
                View All Products
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="aspect-[4/5] rounded-2xl" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))
              : featuredProducts?.map((product, i) => (
                  <motion.div
                    key={product.node.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <ProductCard product={product} />
                  </motion.div>
                ))}
          </div>

          {/* Mobile - View All Button */}
          <div className="mt-12 text-center sm:hidden">
            <Button asChild size="lg" className="rounded-full">
              <Link to="/shop">
                View All Products
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-3xl liquid-glass-dark text-foreground py-16 sm:py-24 px-8 text-center"
          >
            <div className="relative max-w-2xl mx-auto">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-6">
                Ready to elevate your everyday?
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-lg mx-auto">
                Join thousands of customers who trust us for quality, design, and service.
              </p>
              <Button
                asChild
                size="lg"
                className="rounded-full px-8 py-6 text-lg"
              >
                <Link to="/shop">
                  Shop Now
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </motion.div>
  );
}
