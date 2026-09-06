import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight, Sparkles, Truck, Shield, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductCard } from "@/components/site/ProductCard";
import { BentoFeatures } from "@/components/site/BentoFeatures";
import { TestimonialsSection } from "@/components/site/TestimonialsSection";
import { Tilt3D } from "@/components/site/Tilt3D";
import { getProducts, getCollections } from "@/lib/localStore";
import { motion } from "framer-motion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VESTRA — Modern Clothing, Made to Move" },
      {
        name: "description",
        content: "Contemporary clothing for everyday wear. New arrivals dropping weekly, secure checkout, delivered across Cambodia.",
      },
      { property: "og:title", content: "VESTRA — Modern Clothing, Made to Move" },
      { property: "og:description", content: "Contemporary clothing for everyday wear. New arrivals dropping weekly." },
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

const marqueeWords = [
  "NEW ARRIVALS",
  "FREE SHIPPING",
  "SECURE CHECKOUT",
  "SEASONAL EDIT",
  "MADE TO MOVE",
];

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
        {/* Background with animated glow orbs */}
        <div className="absolute inset-0 bg-background overflow-hidden">
          <div className="glow-orb glow-orb-1" />
          <div className="glow-orb glow-orb-2" />
          <div className="glow-orb glow-orb-3" />
        </div>

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
                New Season Edit — Just Dropped
              </motion.div>

              <motion.h1
                {...fadeInUp}
                className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold tracking-tight leading-[0.95]"
              >
                <span className="block text-foreground">Wear</span>
                <span className="block text-muted-foreground">
                  your
                  <span className="text-foreground ml-3 relative">
                    story
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
                Considered clothing for everyday movement — tailored basics, statement
                outerwear, and elevated essentials. New drops every week, delivered across Cambodia.
              </motion.p>

              <motion.div
                {...fadeInUp}
                className="mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
              >
                <Button asChild size="lg" className="rounded-full px-8 py-6 text-lg group">
                  <Link to="/shop">
                    Shop New Arrivals
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="rounded-full px-8 py-6 text-lg"
                >
                  <Link to="/shop">View Lookbook</Link>
                </Button>
              </motion.div>

              {/* Stats */}
              <motion.div
                {...fadeInUp}
                className="mt-16 grid grid-cols-3 gap-8 max-w-md mx-auto lg:mx-0"
              >
                {[
                  ["12+", "New Styles"],
                  ["48h", "Dispatch"],
                  ["4.9★", "Rated by Shoppers"],
                ].map(([stat, label]) => (
                  <div key={label} className="text-center lg:text-left">
                    <div className="text-2xl font-bold text-foreground">{stat}</div>
                    <div className="text-sm text-muted-foreground">{label}</div>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            {/* Right - 3D Hero Scene */}
            <motion.div
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.23, 1, 0.32, 1] }}
              className="relative hidden lg:block"
            >
              <Tilt3D scene perspective={1100} maxTilt={10} glare={false} className="relative">
                <div className="relative grid grid-cols-2 gap-4">
                  <motion.div
                    initial={{ y: 40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    className="space-y-4"
                    style={{ transform: "translateZ(30px)", transformStyle: "preserve-3d" }}
                  >
                    <div className="aspect-[3/4] rounded-3xl overflow-hidden liquid-glass bg-muted">
                      <img
                        src="https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80"
                        alt="VESTRA oversized cotton tee"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="aspect-square rounded-3xl overflow-hidden liquid-glass bg-muted">
                      <img
                        src="https://images.unsplash.com/photo-1516762689617-e1cffcef479d?w=800&q=80"
                        alt="VESTRA ribbed knit sweater"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </motion.div>
                  <motion.div
                    initial={{ y: -40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.5 }}
                    className="space-y-4 pt-12"
                    style={{ transform: "translateZ(60px)", transformStyle: "preserve-3d" }}
                  >
                    <div className="aspect-square rounded-3xl overflow-hidden liquid-glass bg-muted">
                      <img
                        src="https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&q=80"
                        alt="VESTRA tailored blazer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="aspect-[4/3] rounded-3xl overflow-hidden liquid-glass bg-muted">
                      <img
                        src="https://images.unsplash.com/photo-1601333144130-8cbb312386b6?w=800&q=80"
                        alt="VESTRA denim jacket"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </motion.div>
                </div>
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ duration: 0.5, delay: 1 }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 liquid-glass-card rounded-2xl p-4"
                  style={{ transform: "translate(-50%, -50%) translateZ(100px)" }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full liquid-glass flex items-center justify-center">
                      <Shield className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Secure Payment</p>
                      <p className="text-xs text-muted-foreground">Cash on Delivery</p>
                    </div>
                  </div>
                </motion.div>
              </Tilt3D>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Marquee ticker strip */}
      <section className="border-y border-border bg-foreground overflow-hidden py-4">
        <div className="marquee-track">
          {[...marqueeWords, ...marqueeWords, ...marqueeWords].map((word, i) => (
            <span
              key={i}
              className="flex items-center gap-6 px-6 text-background text-sm sm:text-base font-semibold uppercase tracking-widest shrink-0"
            >
              {word}
              <span className="text-secondary text-lg">✦</span>
            </span>
          ))}
        </div>
      </section>

      {/* Trust Badges */}
      <section className="border-b liquid-glass">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              ["Free Shipping", "Nationwide in Cambodia", Truck],
              ["Secure Payment", "Cash on delivery", Shield],
              ["Easy Returns", "14-day exchange window", RotateCcw],
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

      {/* Why VESTRA — Bento Grid */}
      <BentoFeatures />

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
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Shop by Category</h2>
                <p className="text-muted-foreground mt-2">Curated edits for every wardrobe</p>
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
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Featured Pieces</h2>
              <p className="text-muted-foreground mt-2">Editor-picked for the season</p>
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

      {/* Testimonials — Draggable glass cards */}
      <TestimonialsSection />

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
                Your next favorite outfit is one click away
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-lg mx-auto">
                Join shoppers across Cambodia who trust VESTRA for considered design,
                quality fabrics, and easy cash-on-delivery ordering.
              </p>
              <Button
                asChild
                size="lg"
                className="rounded-full px-8 py-6 text-lg"
              >
                <Link to="/shop">
                  Shop the Collection
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
