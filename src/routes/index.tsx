import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductCard } from "@/components/site/ProductCard";
import { getProducts, getCollections } from "@/lib/productStore";
import { getSiteContent, DEFAULT_SITE_CONTENT } from "@/lib/siteContent";
import { motion } from "framer-motion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bakong Joy — Modern Essentials for Women" },
      {
        name: "description",
        content:
          "Shop Bakong Joy: leggings, sports bras, sets and everyday essentials designed for women. New drops weekly, delivered across Cambodia.",
      },
      { property: "og:title", content: "Bakong Joy — Modern Essentials for Women" },
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

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] },
};

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
  const { marquee, cta } = content;
  const tiles = content.dual_tiles?.tiles ?? DEFAULT_SITE_CONTENT.dual_tiles.tiles;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen"
    >
      {/* ── Hero — Bouguessa-style dual tiles ── */}
      <section className="grid md:grid-cols-2">
        {tiles.slice(0, 2).map((tile, i) => (
          <motion.div key={i} {...fadeUp} className="relative h-[72vh] overflow-hidden md:h-[86vh]">
            <img
              src={tile.image}
              alt={tile.heading}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent" />

            <div className="absolute inset-x-0 bottom-0 p-7 sm:p-10 lg:p-12">
              <p className="mb-3 text-[11px] uppercase tracking-[0.25em] text-white/85">
                {tile.eyebrow}
              </p>
              <h1 className="font-serif font-light text-4xl leading-tight text-white sm:text-5xl">
                {tile.heading}
              </h1>
              {tile.subtext && (
                <p className="mt-3 max-w-sm text-sm font-light leading-relaxed text-white/85">
                  {tile.subtext}
                </p>
              )}
              <Link
                to={tile.ctaLink as "/shop"}
                search={tile.ctaSearch ? { q: tile.ctaSearch } : undefined}
                className="mt-6 inline-block border-b border-white pb-1 text-[11px]
                  uppercase tracking-[0.22em] text-white transition-opacity hover:opacity-60"
              >
                {tile.ctaLabel}
              </Link>
            </div>
          </motion.div>
        ))}
      </section>

      {/* ── Marquee — quiet single-line scroll ── */}
      <section className="border-b border-neutral-200 overflow-hidden py-3 bg-white">
        <div className="marquee-track">
          {[...marquee.words, ...marquee.words].map((word, i) => (
            <span
              key={i}
              className="flex items-center gap-8 px-8 text-[10px] uppercase tracking-[0.3em] text-neutral-500 shrink-0"
            >
              {word}
              <span aria-hidden className="text-neutral-300">
                —
              </span>
            </span>
          ))}
        </div>
      </section>

      {/* ── New In — editorial grid ── */}
      <section className="py-20 sm:py-24">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
          <motion.div {...fadeUp} className="flex items-end justify-between mb-10">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-400 mb-3">New In</p>
              <h2 className="font-serif font-light text-3xl sm:text-4xl">Latest Pieces</h2>
            </div>
            <Link
              to="/shop"
              className="hidden sm:inline-flex items-center gap-2 text-[11px]
                uppercase tracking-[0.25em] border-b border-neutral-900 pb-1
                hover:opacity-60 transition-opacity"
            >
              View All
              <ArrowRight className="w-3 h-3" strokeWidth={1.5} />
            </Link>
          </motion.div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-12">
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="space-y-4">
                    <Skeleton className="aspect-[4/5] w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                ))
              : featuredProducts?.map((product) => (
                  <ProductCard key={product.node.id} product={product} />
                ))}
          </div>

          <div className="mt-16 text-center">
            <Link
              to="/shop"
              className="inline-flex items-center gap-3 bg-neutral-900 text-white
                text-[11px] uppercase tracking-[0.25em] px-10 py-4
                hover:bg-neutral-700 transition-colors"
            >
              View All Products
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Categories — square editorial tiles ── */}
      {collections && collections.length > 0 && (
        <section className="py-16 border-t border-neutral-200">
          <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
            <motion.div {...fadeUp} className="mb-10">
              <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-400 mb-3">
                Collections
              </p>
              <h2 className="font-serif font-light text-3xl sm:text-4xl">Shop by Category</h2>
            </motion.div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {collections.slice(0, 6).map((collection) => (
                <motion.div key={collection.node.id} {...fadeUp}>
                  <Link
                    to="/shop"
                    search={{ q: collection.node.title }}
                    className="group relative block aspect-[3/4] overflow-hidden bg-neutral-100"
                  >
                    <div className="absolute inset-0 bg-black/20 transition-colors duration-500 group-hover:bg-black/35" />
                    <div className="absolute inset-x-0 bottom-0 p-5">
                      <p className="text-white text-[11px] uppercase tracking-[0.2em]">
                        {collection.node.title}
                      </p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Closing statement — quiet full-width ── */}
      <section className="py-24 sm:py-28 border-t border-neutral-200">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 text-center">
          <motion.div {...fadeUp} className="max-w-2xl mx-auto">
            <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-400 mb-6">The Edit</p>
            <h2 className="font-serif font-light text-4xl sm:text-5xl leading-tight">
              {cta.heading}
            </h2>
            <p className="mt-5 text-neutral-500 text-[15px] font-light leading-relaxed">
              {cta.subtext}
            </p>
            <Link
              to={cta.buttonLink as "/shop"}
              className="mt-10 inline-block bg-neutral-900 text-white
                text-[11px] uppercase tracking-[0.25em] px-10 py-4
                hover:bg-neutral-700 transition-colors"
            >
              {cta.buttonLabel}
            </Link>
          </motion.div>
        </div>
      </section>
    </motion.div>
  );
}
