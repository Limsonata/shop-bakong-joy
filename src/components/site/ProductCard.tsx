import { Link } from "@tanstack/react-router";
import { Plus, ShoppingBag, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/stores/cartStore";
import type { LocalProductEdge } from "@/lib/localStore";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

export function ProductCard({ product }: { product: LocalProductEdge }) {
  const [isHovered, setIsHovered] = useState(false);
  const addItem = useCartStore((s) => s.addItem);
  const isLoading = useCartStore((s) => s.isLoading);

  const p = product.node;
  const variant = p.variants[0];
  const image = p.images[0];
  const price = parseFloat(p.price.amount);
  const currency = p.price.currencyCode;

  const handleAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!variant) return;
    await addItem({
      product,
      variantId: variant.id,
      variantTitle: variant.title,
      price: variant.price,
      quantity: 1,
      selectedOptions: variant.selectedOptions ?? [],
    });
    toast.success(`Added ${p.title} to cart`, {
      icon: <ShoppingBag className="w-4 h-4" />,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -8 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="group relative flex flex-col"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image Container */}
      <Link
        to="/product/$handle"
        params={{ handle: p.handle }}
        className="relative block aspect-[4/5] overflow-hidden rounded-2xl bg-muted"
      >
        {/* Main Image */}
        <motion.div
          className="absolute inset-0"
          animate={{ scale: isHovered ? 1.08 : 1 }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        >
          {image ? (
            <img
              src={image.url}
              alt={image.altText ?? p.title}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-muted">
              <span className="text-muted-foreground text-sm">No image</span>
            </div>
          )}
        </motion.div>

        {/* Liquid Glass Overlay */}
        <motion.div
          className="absolute inset-0"
          style={{ background: "rgba(0,0,0,0.28)", backdropFilter: "blur(2px) saturate(120%)", WebkitBackdropFilter: "blur(2px) saturate(120%)" }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        />

        {/* Quick Add Button */}
        <AnimatePresence>
          {isHovered && variant && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
              className="absolute bottom-4 left-4 right-4"
            >
              <Button
                className="w-full rounded-full py-6 shadow-xl"
                onClick={handleAdd}
                disabled={isLoading}
              >
                {isLoading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Plus className="h-5 w-5" />
                  </motion.div>
                ) : (
                  <>
                    <Plus className="h-5 w-5 mr-2" />
                    Add to Cart
                  </>
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collection Tag */}
        {p.collections.length > 0 && (
          <div className="absolute top-3 left-3">
            <span className="px-2 py-1 text-xs font-medium liquid-glass-card rounded-full">
              {p.collections[0]}
            </span>
          </div>
        )}

        {/* Hover Arrow */}
        <motion.div
          className="absolute top-3 right-3"
          animate={{ opacity: isHovered ? 1 : 0, scale: isHovered ? 1 : 0.8 }}
          transition={{ duration: 0.2 }}
        >
          <div className="p-2 liquid-glass-card rounded-full">
            <ArrowUpRight className="h-4 w-4" />
          </div>
        </motion.div>
      </Link>

      {/* Product Info */}
      <div className="flex flex-col gap-1 pt-4 px-1">
        <Link to="/product/$handle" params={{ handle: p.handle }} className="group/link block">
          <h3 className="text-sm font-medium text-foreground group-hover/link:text-foreground/70 transition-colors line-clamp-1">
            {p.title}
          </h3>
        </Link>

        {p.productType && <p className="text-xs text-muted-foreground">{p.productType}</p>}

        <div className="flex items-center justify-between mt-1">
          <div className="flex items-baseline gap-1">
            <span className="font-semibold text-lg">
              {currency} {price.toFixed(2)}
            </span>
          </div>

          {/* Mobile Add Button */}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full md:hidden"
            onClick={handleAdd}
            disabled={!variant || isLoading}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
