import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { ArrowLeft, CheckCircle2, Copy, CreditCard, ExternalLink, Loader2, MapPin, Navigation, QrCode, RefreshCw, Truck } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/stores/cartStore";
import { createOrder, type Order } from "@/lib/orderStore";
import { notifyOrderReceipt } from "@/lib/telegramNotify";
import { getTelegramId } from "@/lib/telegramAuth";
import { generatePayWayTransactionId } from "@/lib/payway";
import { confirmPayWayOrder, createPayWayQr } from "@/lib/api/payway.functions";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google: any;
  }
}

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

let mapsLoadPromise: Promise<void> | null = null;
function loadMapsApi(): Promise<void> {
  if (typeof window === "undefined" || !MAPS_KEY) return Promise.reject();
  if (window.google?.maps) return Promise.resolve();
  if (mapsLoadPromise) return mapsLoadPromise;
  mapsLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { mapsLoadPromise = null; reject(); };
    document.head.appendChild(script);
  });
  return mapsLoadPromise;
}

function LocationPicker({
  address,
  onAddressChange,
  disabled,
}: {
  address: string;
  onAddressChange: (address: string, lat?: number, lng?: number) => void;
  disabled?: boolean;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [mapsReady, setMapsReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const callbackRef = useRef(onAddressChange);
  callbackRef.current = onAddressChange;

  useEffect(() => {
    if (!MAPS_KEY) return;
    loadMapsApi().then(() => setMapsReady(true)).catch(() => {});
  }, []);

  const geocode = useCallback((lat: number, lng: number) => {
    const input = document.getElementById("maps-autocomplete") as HTMLInputElement | null;
    new window.google.maps.Geocoder().geocode({ location: { lat, lng } }, (results: any[]) => {
      const addr = results?.[0]?.formatted_address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      if (input) input.value = addr;
      callbackRef.current(addr, lat, lng);
    });
  }, []);

  useEffect(() => {
    if (!mapsReady || !mapRef.current) return;
    const g = window.google;
    const defaultCenter = { lat: 11.5564, lng: 104.9282 }; // Phnom Penh
    const map = new g.maps.Map(mapRef.current, {
      center: defaultCenter,
      zoom: 13,
      mapTypeControl: false,
      streetViewControl: false,
    });
    const marker = new g.maps.Marker({ position: defaultCenter, map, draggable: !disabled });
    mapInstanceRef.current = map;
    markerRef.current = marker;

    const input = document.getElementById("maps-autocomplete") as HTMLInputElement | null;
    if (input) {
      const ac = new g.maps.places.Autocomplete(input, { fields: ["formatted_address", "geometry"] });
      ac.bindTo("bounds", map);
      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        if (!place.geometry?.location) return;
        const lat: number = place.geometry.location.lat();
        const lng: number = place.geometry.location.lng();
        map.setCenter({ lat, lng });
        map.setZoom(16);
        marker.setPosition({ lat, lng });
        callbackRef.current(place.formatted_address || input.value, lat, lng);
      });
    }

    if (!disabled) {
      map.addListener("click", (e: any) => {
        const lat: number = e.latLng.lat();
        const lng: number = e.latLng.lng();
        marker.setPosition({ lat, lng });
        geocode(lat, lng);
      });
      marker.addListener("dragend", () => {
        const pos = marker.getPosition();
        geocode(pos.lat(), pos.lng());
      });
    }
  }, [mapsReady, disabled, geocode]);

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setCenter({ lat, lng });
          mapInstanceRef.current.setZoom(17);
        }
        if (markerRef.current) {
          markerRef.current.setPosition({ lat, lng });
        }
        geocode(lat, lng);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          toast.error("Location access denied. Please allow location in your browser settings.");
        } else {
          toast.error("Unable to get your location. Try searching manually.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [geocode]);

  if (!MAPS_KEY) {
    return (
      <textarea
        value={address}
        onChange={(e) => onAddressChange(e.target.value)}
        placeholder="Enter your full delivery address"
        disabled={disabled}
        required
        rows={3}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="maps-autocomplete"
            defaultValue={address}
            placeholder="Search your delivery location…"
            autoComplete="off"
            disabled={disabled}
            className="pl-9"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled || locating || !mapsReady}
          onClick={handleLocateMe}
          title="Use my current location"
        >
          {locating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Navigation className="h-4 w-4" />
          )}
        </Button>
      </div>
      <div ref={mapRef} className="h-64 w-full overflow-hidden rounded-md border" />
      {!mapsReady && <p className="text-xs text-muted-foreground">Loading map…</p>}
      {mapsReady && !disabled && (
        <p className="text-xs text-muted-foreground">
          Tap the map or drag the pin to adjust your exact location.
        </p>
      )}
    </div>
  );
}

type PaymentMethod = "cod" | "aba";

type PayWayPayment = {
  tranId: string;
  qrString: string;
  qrImage: string;
  deeplink: string;
  appStore: string;
  playStore: string;
  amount: number;
  currency: string;
};

export const Route = createFileRoute("/checkout/bakong")({
  head: () => ({ meta: [{ title: "Checkout - Hairora" }] }),
  component: Checkout,
});

function Checkout() {
  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [formData, setFormData] = useState({ name: "", phone: "", address: "", lat: 0, lng: 0 });
  const [payWayPayment, setPayWayPayment] = useState<PayWayPayment | null>(null);
  const [pendingOrder, setPendingOrder] = useState<Order | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);

  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (sum, item) => sum + Number.parseFloat(item.price.amount) * item.quantity,
      0,
    );
    return { total: subtotal, currency: items[0]?.price.currencyCode ?? "USD" };
  }, [items]);

  const orderItems = useMemo(
    () =>
      items.map((item) => ({
        productId: item.product.node.id,
        variantId: item.variantId,
        title: item.product.node.title,
        quantity: item.quantity,
        price: Number.parseFloat(item.price.amount),
        currency: item.price.currencyCode,
        imageUrl: item.product.node.images[0]?.url,
      })),
    [items],
  );

  const handleCopy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (items.length === 0) { toast.error("Your cart is empty"); return; }
    if (!formData.address) { toast.error("Please enter a delivery location"); return; }

    setIsSubmitting(true);
    try {
      if (paymentMethod === "cod") {
        const order = await createOrder({
          customerName: formData.name,
          phone: formData.phone,
          address: formData.address,
          total: totals.total,
          currency: totals.currency,
          bakongReference: "COD",
          bakongTransactionId: "",
          items: orderItems,
        });
        notifyOrderReceipt(getTelegramId(), order);
        toast.success("Order placed! We'll deliver to you soon.");
        clearCart();
        setIsSubmitted(true);
      } else {
        const tranId = generatePayWayTransactionId();
        const order = await createOrder({
          customerName: formData.name,
          phone: formData.phone,
          address: formData.address,
          total: totals.total,
          currency: totals.currency,
          bakongReference: tranId,
          bakongTransactionId: tranId,
          items: orderItems,
        });
        const payment = await createPayWayQr({ data: { orderId: order.id, tranId } });
        setPendingOrder(order);
        setPayWayPayment(payment as PayWayPayment);
        notifyOrderReceipt(getTelegramId(), order);
        toast.success("ABA PayWay QR generated — scan to pay");
      }
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to place order");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckPayment = async () => {
    if (!pendingOrder || !payWayPayment) return;
    setIsCheckingPayment(true);
    try {
      const result = await confirmPayWayOrder({
        data: { orderId: pendingOrder.id, tranId: payWayPayment.tranId },
      });
      if (result.paid) {
        toast.success("Payment received!");
        clearCart();
        setIsSubmitted(true);
      } else {
        toast.info(result.message || `Payment status: ${result.status}`);
      }
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to check payment");
    } finally {
      setIsCheckingPayment(false);
    }
  };

  if (isSubmitted) {
    const isCod = paymentMethod === "cod";
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-xl items-center px-4 py-12 sm:px-6">
        <Card className="w-full">
          <CardHeader className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
            <CardTitle>{isCod ? "Order placed!" : "Payment received!"}</CardTitle>
            <CardDescription>
              {isCod
                ? "Your order is confirmed. Our delivery team will contact you shortly to arrange delivery and collect payment."
                : "Your ABA PayWay payment is approved and your order is ready for fulfillment."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-center">
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

  const isLocked = !!payWayPayment;

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
          {/* Customer details */}
          <Card>
            <CardHeader>
              <CardTitle>Customer details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={isLocked}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone number</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    disabled={isLocked}
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Delivery location */}
          <Card>
            <CardHeader>
              <CardTitle>Delivery location</CardTitle>
              <CardDescription>
                {MAPS_KEY
                  ? "Search or pin your location on the map."
                  : "Enter your delivery address."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LocationPicker
                address={formData.address}
                onAddressChange={(address, lat, lng) =>
                  setFormData((f) => ({ ...f, address, lat: lat ?? f.lat, lng: lng ?? f.lng }))
                }
                disabled={isLocked}
              />
              {formData.lat !== 0 && formData.lng !== 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  📍 {formData.lat.toFixed(5)}, {formData.lng.toFixed(5)}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Payment method selector */}
          {!payWayPayment && (
            <Card>
              <CardHeader>
                <CardTitle>Payment method</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("cod")}
                    className={cn(
                      "rounded-lg border p-4 text-left transition-colors",
                      paymentMethod === "cod"
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50",
                    )}
                  >
                    <Truck className="mb-2 h-5 w-5 text-primary" />
                    <p className="font-medium">Pay on delivery</p>
                    <p className="text-xs text-muted-foreground">Cash when we arrive</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("aba")}
                    className={cn(
                      "rounded-lg border p-4 text-left transition-colors",
                      paymentMethod === "aba"
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50",
                    )}
                  >
                    <CreditCard className="mb-2 h-5 w-5 text-primary" />
                    <p className="font-medium">ABA Pay</p>
                    <p className="text-xs text-muted-foreground">ABA app or KHQR</p>
                  </button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ABA PayWay QR (shown after submit) */}
          {payWayPayment && (
            <Card>
              <CardHeader>
                <CardTitle>ABA PayWay payment</CardTitle>
                <CardDescription>Scan the QR with your ABA app or any KHQR-supported bank.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
                  <div className="flex aspect-square items-center justify-center rounded-md border bg-white p-3">
                    {payWayPayment.qrImage ? (
                      <img src={payWayPayment.qrImage} alt="ABA PayWay QR" className="h-full w-full object-contain" />
                    ) : payWayPayment.qrString ? (
                      <QRCodeCanvas value={payWayPayment.qrString} size={200} level="M" marginSize={2} className="h-full w-full" />
                    ) : (
                      <QrCode className="h-16 w-16 text-muted-foreground" />
                    )}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Amount</p>
                      <p className="text-xl font-semibold">
                        {(payWayPayment.currency || totals.currency).toUpperCase()}{" "}
                        {(payWayPayment.amount ?? totals.total).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Transaction ID</p>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{payWayPayment.tranId}</p>
                        <Button type="button" size="icon" variant="ghost" onClick={() => handleCopy(payWayPayment.tranId, "Transaction ID")}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {payWayPayment.deeplink && (
                      <Button asChild type="button" variant="outline" size="sm">
                        <a href={payWayPayment.deeplink}>
                          Open ABA Mobile <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action button */}
          {payWayPayment ? (
            <Button type="button" size="lg" className="w-full" onClick={handleCheckPayment} disabled={isCheckingPayment}>
              <RefreshCw className={cn("mr-2 h-4 w-4", isCheckingPayment && "animate-spin")} />
              {isCheckingPayment ? "Checking payment…" : "I've paid — confirm payment"}
            </Button>
          ) : (
            <Button type="submit" size="lg" className="w-full" disabled={!items.length || isSubmitting}>
              {isSubmitting
                ? "Placing order…"
                : paymentMethod === "cod"
                  ? "Place order — pay on delivery"
                  : "Continue to ABA Pay"}
            </Button>
          )}
        </form>

        {/* Order summary sidebar */}
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
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
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
                  <span>{totals.currency} {totals.total.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
