import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { ArrowLeft, Banknote, CheckCircle2, Copy, Download, Loader2, MapPin, Navigation, QrCode, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCartStore } from "@/stores/cartStore";
import { createOrder } from "@/lib/orderStore";
import { notifyOrderReceipt } from "@/lib/telegramNotify";
import { getTelegramId } from "@/lib/telegramAuth";
import { OsmLocationPicker } from "@/components/site/OsmLocationPicker";

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
  lat,
  lng,
  onAddressChange,
  disabled,
}: {
  address: string;
  lat: number;
  lng: number;
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
      <OsmLocationPicker
        address={address}
        onAddressChange={(a) => onAddressChange(a)}
        lat={lat}
        lng={lng}
        onPinChange={(la, ln) => onAddressChange(address, la, ln)}
        disabled={disabled}
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

export const Route = createFileRoute("/checkout/bakong")({
  head: () => ({ meta: [{ title: "Checkout - BillieGrace Closet" }] }),
  component: Checkout,
});

function Checkout() {
  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);
  const [formData, setFormData] = useState({ name: "", phone: "", address: "", lat: 0, lng: 0 });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [payMethod, setPayMethod] = useState<"qr" | "cod">("qr");
  const [hasPaid, setHasPaid] = useState(false);

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Couldn't copy. Please copy it manually.");
    }
  };

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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (items.length === 0) { toast.error("Your cart is empty"); return; }
    if (!formData.address) { toast.error("Please enter a delivery location"); return; }

    const hasPin = formData.lat !== 0 && formData.lng !== 0;
    setIsSubmitting(true);
    try {
      const order = await createOrder({
        customerName: formData.name,
        phone: formData.phone,
        address: hasPin
          ? `${formData.address}\nMap: https://www.google.com/maps?q=${formData.lat.toFixed(6)},${formData.lng.toFixed(6)}`
          : formData.address,
        total: totals.total,
        currency: totals.currency,
        bakongReference: payMethod === "qr" ? "ABA-QR" : "COD",
        bakongTransactionId: "",
        items: orderItems,
      });
      notifyOrderReceipt(getTelegramId(), order);
      toast.success("Order placed! We'll deliver to you soon.");
      clearCart();
      setIsSubmitted(true);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to place order");
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
            <CardTitle>Order placed!</CardTitle>
            <CardDescription>
              Your order is confirmed. {payMethod === "qr"
                ? "We'll verify your ABA QR payment shortly and then arrange delivery."
                : "Our delivery team will contact you shortly to arrange delivery and collect payment."}
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link
        to="/shop"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to shop
      </Link>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer details */}
          <Card>
            <CardHeader>
              <CardTitle>Customer details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone number</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
                  : "Enter your delivery address, then pin your location on the map."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LocationPicker
                address={formData.address}
                lat={formData.lat}
                lng={formData.lng}
                onAddressChange={(address, lat, lng) =>
                  setFormData((f) => ({ ...f, address, lat: lat ?? f.lat, lng: lng ?? f.lng }))
                }
              />
              {formData.lat !== 0 && formData.lng !== 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  📍 {formData.lat.toFixed(5)}, {formData.lng.toFixed(5)}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Payment method */}
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Payment method</CardTitle>
              <CardDescription>Choose how you'd like to pay for this order.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(
                  [
                    { id: "qr", icon: QrCode, title: "Pay by ABA QR", desc: "Scan with any KHQR banking app" },
                    { id: "cod", icon: Truck, title: "Pay on delivery", desc: "Cash when we arrive" },
                  ] as const
                ).map(({ id, icon: Icon, title, desc }) => {
                  const active = payMethod === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setPayMethod(id)}
                      className={`relative flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                        active
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                          active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium">{title}</span>
                        <span className="block text-xs text-muted-foreground">{desc}</span>
                      </span>
                      {active && <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 text-primary" />}
                    </button>
                  );
                })}
              </div>

              {payMethod === "qr" ? (
                <div className="rounded-2xl border bg-gradient-to-b from-muted/50 to-background p-4 sm:p-6">
                  <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-[240px_1fr]">
                    <div className="mx-auto w-full max-w-[240px]">
                      <img
                        src="/aba-qr-card.jpeg"
                        alt="ABA KHQR payment code for Sreynich Youern"
                        className="w-full rounded-xl border bg-white shadow-md"
                      />
                      <Button asChild variant="ghost" size="sm" className="mt-2 w-full">
                        <a href="/aba-qr-full.jpeg" download="BillieGrace-ABA-QR.jpeg">
                          <Download className="mr-2 h-4 w-4" /> Save QR to phone
                        </a>
                      </Button>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-xl bg-primary/10 p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Amount to pay
                        </p>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-3xl font-semibold">
                            {totals.currency} {totals.total.toFixed(2)}
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => copyText(totals.total.toFixed(2), "Amount")}
                          >
                            <Copy className="mr-1 h-4 w-4" /> Copy
                          </Button>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          This QR doesn't fill the amount for you. Please type it in exactly.
                        </p>
                      </div>

                      <ol className="space-y-2 text-sm">
                        {[
                          "Open ABA Mobile or any KHQR banking app.",
                          "Scan the QR code, or upload the saved image.",
                          `Enter ${totals.currency} ${totals.total.toFixed(2)} and confirm.`,
                          "Tick the box below, then place your order.",
                        ].map((step, i) => (
                          <li key={step} className="flex gap-3">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                              {i + 1}
                            </span>
                            <span className="pt-0.5">{step}</span>
                          </li>
                        ))}
                      </ol>

                      <div className="space-y-1 rounded-xl border bg-background p-3 text-sm">
                        <p className="font-medium">Sreynich Youern · ABA Bank</p>
                        {[
                          { label: "USD account", value: "019 013 739" },
                          { label: "KHR account", value: "006 659 744" },
                        ].map((acc) => (
                          <div key={acc.label} className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground">{acc.label}</span>
                            <span className="flex items-center gap-1 font-mono">
                              {acc.value}
                              <button
                                type="button"
                                aria-label={`Copy ${acc.label}`}
                                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                onClick={() => copyText(acc.value.replace(/\s/g, ""), acc.label)}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border bg-background p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={hasPaid}
                      onChange={(e) => setHasPaid(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
                    />
                    <span>
                      I have completed the payment of{" "}
                      <strong>
                        {totals.currency} {totals.total.toFixed(2)}
                      </strong>{" "}
                      by ABA QR. We'll confirm it shortly.
                    </span>
                  </label>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-2xl border bg-muted/30 p-4 text-sm">
                  <Banknote className="h-6 w-6 shrink-0 text-primary" />
                  <p>
                    Prepare <strong>{totals.currency} {totals.total.toFixed(2)}</strong> in cash. Our
                    delivery team will collect it when your order arrives.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action button */}
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={!items.length || isSubmitting || (payMethod === "qr" && !hasPaid)}
          >
            {isSubmitting
              ? "Placing order…"
              : payMethod === "qr"
                ? "I've paid — place order"
                : "Place order — pay on delivery"}
          </Button>
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
