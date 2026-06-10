import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Copy, QrCode } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCartStore } from "@/stores/cartStore";
import { getBakongPaymentConfig, isBakongConfigured, generateBakongQR } from "@/lib/bakong";
import { createOrder } from "@/lib/orderStore";
import { notifyOrderReceipt } from "@/lib/telegramNotify";
import { getTelegramId } from "@/lib/telegramAuth";

export const Route = createFileRoute("/checkout/bakong")({
  head: () => ({ meta: [{ title: "Bakong Checkout - Shop Bakong Joy" }] }),
  component: BakongCheckout,
});

function BakongCheckout() {
  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);
  const config = getBakongPaymentConfig();
  const configured = isBakongConfigured(config);
  const [paymentReference, setPaymentReference] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: "",
    transactionId: "",
  });

  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (sum, item) => sum + Number.parseFloat(item.price.amount) * item.quantity,
      0,
    );

    return {
      subtotal,
      total: subtotal,
      currency: items[0]?.price.currencyCode ?? config.currencyCode,
    };
  }, [config.currencyCode, items]);

  useEffect(() => {
    setPaymentReference(`SBJ-${Date.now().toString(36).toUpperCase()}`);
  }, []);

  const qrString = useMemo(() => {
    if (!configured || totals.total <= 0) return "";
    return generateBakongQR(config, {
      amount: totals.total,
      currency: totals.currency,
      reference: paymentReference,
      description: `Order ${paymentReference}`,
      storeLabel: config.merchantName,
    });
  }, [config, configured, totals.total, totals.currency, paymentReference]);

  const handleCopy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!configured) {
      toast.error("Bakong payment is not configured");
      return;
    }

    if (items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    setIsSubmitting(true);
    try {
      const order = await createOrder({
        customerName: formData.name,
        phone: formData.phone,
        address: formData.address,
        total: totals.total,
        currency: totals.currency,
        bakongReference: paymentReference,
        bakongTransactionId: formData.transactionId,
        items: items.map((item) => ({
          productId: item.product.node.id,
          title: item.product.node.title,
          quantity: item.quantity,
          price: Number.parseFloat(item.price.amount),
          currency: item.price.currencyCode,
          imageUrl: item.product.node.images[0]?.url,
        })),
      });

      // Send Telegram receipt if user logged in via Telegram
      const telegramId = getTelegramId();
      if (telegramId) {
        notifyOrderReceipt(telegramId, order);
      }

      toast.success("Order submitted!");
      setIsSubmitted(true);
      clearCart();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to submit order");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-xl items-center px-4 py-12 sm:px-6">
        <Card className="w-full">
          <CardHeader className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
            <CardTitle>Order submitted</CardTitle>
            <CardDescription>
              We received your order and Bakong payment reference. Once we confirm payment, we will
              start fulfillment.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-center">
            {paymentReference && (
              <div className="rounded-md border bg-muted p-3 text-sm">
                <p className="text-xs text-muted-foreground">Reference</p>
                <p className="font-medium">{paymentReference}</p>
              </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button asChild>
                <Link to="/orders">View my orders</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/shop">Continue shopping</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link
        to="/shop"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to shop
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer details</CardTitle>
              <CardDescription>Enter the delivery information for this order.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone number</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Delivery address</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(event) => setFormData({ ...formData, address: event.target.value })}
                  required
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bakong payment</CardTitle>
              <CardDescription>
                Pay the exact total and submit your transaction reference.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!configured && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                  Add <code>VITE_BAKONG_MERCHANT_ACCOUNT</code> or{" "}
                  <code>VITE_BAKONG_QR_IMAGE_URL</code> to enable live Bakong payments.
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
                <div className="flex aspect-square items-center justify-center rounded-md border bg-white p-3">
                  {qrString ? (
                    <QRCodeCanvas
                      value={qrString}
                      size={200}
                      level="M"
                      marginSize={2}
                      imageSettings={
                        config.qrImageUrl
                          ? {
                              src: config.qrImageUrl,
                              height: 32,
                              width: 32,
                              excavate: true,
                            }
                          : undefined
                      }
                      className="h-full w-full"
                    />
                  ) : config.qrImageUrl ? (
                    <img
                      src={config.qrImageUrl}
                      alt={`${config.merchantName} Bakong QR`}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <QrCode className="h-16 w-16 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Merchant</p>
                    <p className="font-medium">{config.merchantName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Bakong account</p>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{config.merchantAccount || "Not configured"}</p>
                      {config.merchantAccount && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => handleCopy(config.merchantAccount, "Bakong account")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Amount</p>
                    <p className="text-xl font-semibold">
                      {totals.currency} {totals.total.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Reference</p>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{paymentReference || "Generating..."}</p>
                      {paymentReference && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => handleCopy(paymentReference, "Reference")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {qrString && (
                    <p className="text-xs text-muted-foreground">
                      Scan with the Bakong app or any KHQR-supported banking app
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="transactionId">Bakong transaction ID</Label>
                <Input
                  id="transactionId"
                  value={formData.transactionId}
                  onChange={(event) =>
                    setFormData({ ...formData, transactionId: event.target.value })
                  }
                  required
                />
              </div>
            </CardContent>
          </Card>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={!items.length || !configured || isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Submit order"}
          </Button>
        </form>

        <aside>
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle>Order summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Your cart is empty.</p>
              ) : (
                items.map((item) => (
                  <div key={item.lineId} className="flex gap-3">
                    <div className="h-14 w-14 overflow-hidden rounded-md bg-muted">
                      {item.product.node.images[0] && (
                        <img
                          src={item.product.node.images[0].url}
                          alt={item.product.node.title}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.product.node.title}</p>
                      <p className="text-sm text-muted-foreground">Qty {item.quantity}</p>
                    </div>
                    <p className="text-sm font-medium">
                      {item.price.currencyCode}{" "}
                      {(Number.parseFloat(item.price.amount) * item.quantity).toFixed(2)}
                    </p>
                  </div>
                ))
              )}

              <div className="border-t pt-4">
                <div className="flex items-center justify-between font-semibold">
                  <span>Total</span>
                  <span>
                    {totals.currency} {totals.total.toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
