import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Minus, Plus, Trash2, ExternalLink, ArrowRight, Package } from "lucide-react";
import { useCartStore } from "@/stores/cartStore";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

export function CartDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [itemsAnimating, setItemsAnimating] = useState<Record<string, boolean>>({});
  const items = useCartStore((s) => s.items);
  const isLoading = useCartStore((s) => s.isLoading);
  const isSyncing = useCartStore((s) => s.isSyncing);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const getCheckoutUrl = useCartStore((s) => s.getCheckoutUrl);
  const syncCart = useCartStore((s) => s.syncCart);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce(
    (sum, item) => sum + parseFloat(item.price.amount) * item.quantity,
    0,
  );
  const currency = items[0]?.price.currencyCode ?? "USD";

  useEffect(() => {
    if (isOpen) syncCart();
  }, [isOpen, syncCart]);

  const handleUpdateQuantity = async (variantId: string, newQty: number) => {
    setItemsAnimating((prev) => ({ ...prev, [variantId]: true }));
    await updateQuantity(variantId, newQty);
    setTimeout(() => {
      setItemsAnimating((prev) => ({ ...prev, [variantId]: false }));
    }, 200);
  };

  const handleRemove = async (variantId: string) => {
    setItemsAnimating((prev) => ({ ...prev, [variantId]: true }));
    setTimeout(() => {
      removeItem(variantId);
      toast.success("Item removed from cart");
    }, 200);
  };

  const handleCheckout = () => {
    const url = getCheckoutUrl();
    if (!url) {
      toast.error("Checkout is not ready", {
        description: "Please add an available product to your cart before checkout.",
      });
      setIsOpen(false);
      return;
    }
    window.location.href = url;
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <ShoppingBag className="h-5 w-5" />
          </motion.div>
          <AnimatePresence>
            {totalItems > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              >
                <Badge className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-background bg-foreground p-0 px-1.5 text-[10px] font-bold">
                  {totalItems}
                </Badge>
              </motion.div>
            )}
          </AnimatePresence>
        </Button>
      </SheetTrigger>
      <SheetContent className="flex h-full w-full flex-col sm:max-w-lg border-l border-border/50 bg-background">
        <SheetHeader className="flex-shrink-0 border-b pb-4">
          <div className="flex items-center gap-2">
            <SheetTitle className="flex items-center gap-2 text-xl">
              <ShoppingBag className="h-5 w-5" />
              Your Cart
            </SheetTitle>
          </div>
          <SheetDescription className="text-sm">
            {totalItems === 0
              ? "Your cart is empty"
              : `${totalItems} item${totalItems !== 1 ? "s" : ""} in your cart`}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col pt-6">
          <AnimatePresence mode="wait">
            {items.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-1 flex-col items-center justify-center"
              >
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                  className="mb-6 rounded-full bg-muted p-6"
                >
                  <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground" />
                </motion.div>
                <p className="text-muted-foreground text-center">
                  Your bag is empty
                  <br />
                  <span className="text-sm">Start adding some items!</span>
                </p>
                <Button asChild className="mt-6 rounded-full" onClick={() => setIsOpen(false)}>
                  <Link to="/shop">
                    Continue Shopping
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="items"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="min-h-0 flex-1 overflow-y-auto pr-2">
                  <AnimatePresence mode="popLayout">
                    {items.map((item, index) => (
                      <motion.div
                        key={item.variantId}
                        layout
                        initial={{ opacity: 0, x: 20 }}
                        animate={{
                          opacity: itemsAnimating[item.variantId] ? 0.5 : 1,
                          x: itemsAnimating[item.variantId] ? -20 : 0,
                        }}
                        exit={{ opacity: 0, x: -100, height: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className="flex gap-4 py-4 border-b last:border-b-0"
                      >
                        {/* Product Image */}
                        <Link
                          to="/product/$handle"
                          params={{ handle: item.product.node.handle }}
                          onClick={() => setIsOpen(false)}
                          className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-muted"
                        >
                          {item.product.node.images?.[0] ? (
                            <img
                              src={item.product.node.images[0].url}
                              alt={item.product.node.title}
                              className="h-full w-full object-cover hover:scale-110 transition-transform duration-300"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Package className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                        </Link>

                        {/* Product Info */}
                        <div className="min-w-0 flex-1 flex flex-col">
                          <Link
                            to="/product/$handle"
                            params={{ handle: item.product.node.handle }}
                            onClick={() => setIsOpen(false)}
                          >
                            <h4 className="font-medium truncate hover:underline">
                              {item.product.node.title}
                            </h4>
                          </Link>
                          {item.selectedOptions.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {item.selectedOptions.map((o) => o.value).join(" • ")}
                            </p>
                          )}
                          <div className="mt-auto flex items-center justify-between">
                            {/* Quantity Controls */}
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 rounded-full"
                                onClick={() =>
                                  handleUpdateQuantity(item.variantId, item.quantity - 1)
                                }
                                disabled={isLoading}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <motion.span
                                key={item.quantity}
                                initial={{ scale: 1.2 }}
                                animate={{ scale: 1 }}
                                className="w-8 text-center text-sm font-medium"
                              >
                                {item.quantity}
                              </motion.span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 rounded-full"
                                onClick={() =>
                                  handleUpdateQuantity(item.variantId, item.quantity + 1)
                                }
                                disabled={isLoading}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>

                            {/* Price & Remove */}
                            <div className="flex items-center gap-3">
                              <span className="font-semibold">
                                {item.price.currencyCode}{" "}
                                {(parseFloat(item.price.amount) * item.quantity).toFixed(2)}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-full text-muted-foreground hover:text-destructive"
                                onClick={() => handleRemove(item.variantId)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {/* Cart Footer */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex-shrink-0 space-y-4 border-t bg-background pt-4 mt-4"
                >
                  {/* Summary */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span>
                        {currency} {totalPrice.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Shipping</span>
                      <span>Calculated at checkout</span>
                    </div>
                    <div className="flex items-center justify-between border-t pt-2">
                      <span className="text-lg font-semibold">Total</span>
                      <span className="text-xl font-bold">
                        {currency} {totalPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Checkout Button */}
                  <Button
                    onClick={handleCheckout}
                    className="w-full rounded-full py-6 text-lg shadow-lg hover:shadow-xl transition-shadow"
                    size="lg"
                    disabled={items.length === 0 || isLoading || isSyncing}
                  >
                    {isLoading || isSyncing ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      >
                        <ExternalLink className="h-5 w-5" />
                      </motion.div>
                    ) : (
                      <>
                        Checkout
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => setIsOpen(false)}
                    asChild
                  >
                    <Link to="/shop">Continue Shopping</Link>
                  </Button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </SheetContent>
    </Sheet>
  );
}
