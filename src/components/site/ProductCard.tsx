import { Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { useCartStore } from "@/stores/cartStore";
import type { ProductEdge } from "@/lib/productStore";
import { toast } from "sonner";
import { motion } from "framer-motion";

/**
 * Editorial product card — static frame, square-cropped image,
 * quiet underline hover. No tilt, no glass, no pills.
 */
export function ProductCard({ product }: { product: ProductEdge }) {
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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      className="group"
    >
      <Link to="/product/$handle" params={{ handle: p.handle }} className="block">
        {/* Image frame — plain, square crop, no chrome */}
        <div className="relative overflow-hidden bg-muted aspect-[4/5]">
          {image ? (
            <img
              src={image.url}
              alt={image.altText || p.title}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="font-serif text-sm uppercase tracking-[0.2em] text-muted-foreground">
                {p.title}
              </span>
            </div>
          )}

          {/* Quiet add-to-cart — thin bar, bottom edge */}
          <button
            onClick={handleAdd}
            disabled={isLoading}
            className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-center gap-2
              bg-neutral-900 text-white text-[11px] uppercase tracking-[0.2em]
              py-3 translate-y-full opacity-0 transition-all duration-300
              hover:bg-neutral-700 disabled:opacity-50
              group-hover:translate-y-0 group-hover:opacity-100"
          >
            <ShoppingBag className="w-3.5 h-3.5" strokeWidth={1.5} />
            Add to Cart
          </button>
        </div>

        {/* Caption — title left, price right, plain row */}
        <div className="mt-4 flex items-baseline justify-between gap-4">
          <h3 className="font-serif text-[15px] leading-snug">{p.title}</h3>
          <span className="text-[13px] text-muted-foreground whitespace-nowrap">
            {currency === "USD" ? "$" : ""}
            {price.toFixed(2)}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
