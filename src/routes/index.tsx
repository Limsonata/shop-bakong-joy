import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight, Truck, ShieldCheck, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductCard } from "@/components/site/ProductCard";
import { getProducts, getCollections } from "@/lib/productStore";
import { getSiteContent, DEFAULT_SITE_CONTENT } from "@/lib/siteContent";
import { motion } from "framer-motion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BillieGrace Closet — Activewear & Everyday Essentials for Women" },
      {
        name: "description",
        content:
          "Shop BillieGrace Closet: leggings, sports bras, sets and everyday essentials designed for women. New drops weekly, delivered across Cambodia.",
      },
      { property: "og:title", content: "BillieGrace Closet — Made for Her" },
      {
        property: "og:description",
        content:
          "Activewear and everyday essentials designed for women. New arrivals dropping weekly.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Index,
});

const fadeInUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] },
};

const trustIcons = [Truck, ShieldCheck, RotateCcw];

function Index() {
  const { data: featuredProducts, isLoading } = useQuery({
    queryKey: ["products", "featured"],
    queryFn: () => getProducts({ first: 12, onlyPublished: true }),
  });

  const { data: collections } = useQuery({
    queryKey: ["collections"],
    queryFn: () => getCollections({ first: 6 }),
  });

  const { data: siteContent } = useQuery({
    queryKey: ["site-content"],
    queryFn: () => getSiteContent(),
  });

  // Fall back to the built-in defaults while loading (or if the section is
  // somehow missing) so the homepage never renders empty/broken.
  const content = siteContent ?? DEFAULT_SITE_CONTENT;
  const { hero, marquee, trust_strip, cta } = content;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen"
    >
      {/* Hero — bold, full-bleed, one clear CTA (Gymshark-style) */}
      <section className="relative min-h-[86vh] flex items-end overflow-hidden bg-foreground">
        <div className="absolute inset-0">
          <img
            src={hero.backgroundImage}
            alt="Woman wearing BillieGrace Closet activewear"
            className="h-full w-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground via-foreground/30 to-foreground/10" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full pb-16 pt-32">
          <motion.div {...fadeInUp} className="max-w-2xl">
            <span className="inline-block mb-5 px-4 py-1.5 rounded-full bg-background/10 border border-background/20 text-background text-xs font-semibold uppercase tracking-widest">
              {hero.badge}
            </span>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[0.95] text-background">
              {hero.headingLine1}
              <br />
              <span style={{ color: "oklch(78% 0.10 15)" }}>{hero.headingLine2}</span>
            </h1>
            <p className="mt-6 text-lg text-background/75 max-w-lg">{hero.subtext}</p>
            <div className="mt-9 flex flex-wrap gap-4">
              <Button
                asChild
                size="lg"
                className="rounded-full px-8 py-6 text-lg bg-background text-foreground hover:bg-background/90 group"
              >
                <Link to={hero.primaryButtonLink as "/shop"}>
                  {hero.primaryButtonLabel}
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-full px-8 py-6 text-lg bg-transparent border-background/40 text-background hover:bg-background/10 hover:text-background"
              >
                <Link to="/shop" search={{ q: hero.secondaryButtonSearch }}>
                  {hero.secondaryButtonLabel}
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Marquee ticker */}
      <section className="border-y border-border bg-foreground overflow-hidden py-3">
        <div className="marquee-track">
          {[...marquee.words, ...marquee.words, ...marquee.words].map((word, i) => (
            <span
              key={i}
              className="flex items-center gap-6 px-6 text-background text-sm font-bold uppercase tracking-widest shrink-0"
            >
              {word}
              <span style={{ color: "oklch(78% 0.10 15)" }} className="text-lg">
                ✦
              </span>
            </span>
          ))}
        </div>
      </section>

      {/* Shop by category — straight into product discovery, no filler */}
      {collections && collections.length > 0 && (
        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex items-end justify-between mb-8"
            >
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Shop by Category
              </h2>
              <Link
                to="/shop"
                className="hidden sm:flex items-center gap-1 text-sm font-semibold hover:gap-2 transition-all"
              >
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
              {collections.slice(0, 6).map((collection, i) => (
                <motion.div
                  key={collection.node.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link
                    to="/shop"
                    search={{ q: collection.node.title }}
                    className="group relative block aspect-square rounded-2xl overflow-hidden bg-muted"
                  >
                    <div className="absolute inset-0 bg-black/35 group-hover:bg-black/45 transition-colors" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <p className="text-white font-semibold">{collection.node.title}</p>
                    </div>
                    <ArrowUpRight className="absolute top-3 right-3 w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Product grid — the whole homepage revolves around this */}
      <section className="py-8 sm:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex items-end justify-between mb-8"
          >
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Shop All</h2>
              <p className="text-muted-foreground mt-1 text-sm">Every piece, all in one place</p>
            </div>
            <Button asChild variant="ghost" className="hidden sm:flex font-semibold">
              <Link to="/shop">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {isLoading
              ? Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="aspect-[4/5] rounded-2xl" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))
              : featuredProducts?.map((product, i) => (
                  <motion.div
                    key={product.node.id}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: (i % 4) * 0.05 }}
                  >
                    <ProductCard product={product} />
                  </motion.div>
                ))}
          </div>

          <div className="mt-10 text-center">
            <Button asChild size="lg" className="rounded-full px-10">
              <Link to="/shop">
                View All Products
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Trust strip — compact, functional, no marketing fluff */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {trust_strip.items.map(({ title, desc }, i) => {
              const Icon = trustIcons[i % trustIcons.length];
              return (
                <motion.div
                  key={`${title}-${i}`}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-center gap-4"
                >
                  <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{title}</p>
                    <p className="text-sm text-muted-foreground">{desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-3xl bg-foreground text-background py-16 sm:py-20 px-8 text-center"
          >
            <div className="relative max-w-2xl mx-auto">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-5">
                {cta.heading}
              </h2>
              <p className="text-lg text-background/70 mb-8 max-w-lg mx-auto">{cta.subtext}</p>
              <Button
                asChild
                size="lg"
                className="rounded-full px-8 py-6 text-lg bg-background text-foreground hover:bg-background/90"
              >
                <Link to={cta.buttonLink as "/shop"}>
                  {cta.buttonLabel}
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
