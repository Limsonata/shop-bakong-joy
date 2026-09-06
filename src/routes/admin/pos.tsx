import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Minus, Plus, Search, ShoppingCart, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatPrice } from "@/lib/format";
import { listStockItems, recordSale } from "@/lib/pos/store";
import {
  PAYMENT_METHODS,
  round2,
  stockLeft,
  type SaleChannel,
  type StockItem,
} from "@/lib/pos/types";

export const Route = createFileRoute("/admin/pos")({
  head: () => ({ meta: [{ title: "New sale - Admin" }] }),
  component: PosPage,
});

interface CartLine {
  stockItemId: string | null;
  sku: string;
  name: string;
  size: string;
  color: string;
  qty: number;
  unitPrice: number;
  unitCost: number;
  /** Units on the shelf; null for a custom line that is not tracked in stock. */
  available: number | null;
}

const DELIVERY_METHODS = ["Pickup", "Delivery", "VET Express", "J&T", "Grab", "Other"];
const CITY_SUGGESTIONS = [
  "Phnom Penh",
  "Battambang",
  "Siem Reap",
  "Sihanoukville",
  "Kampong Speu",
  "Kampong Cham",
];

const today = () => new Date().toISOString().slice(0, 10);

function PosPage() {
  const navigate = useNavigate();

  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [saving, setSaving] = useState(false);

  const [soldAt, setSoldAt] = useState(today());
  const [channel, setChannel] = useState<SaleChannel>("walk-in");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("Pickup");
  const [deliveryFee, setDeliveryFee] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [paidInput, setPaidInput] = useState("");
  const [note, setNote] = useState("");

  // Custom (untracked) line
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");

  useEffect(() => {
    listStockItems()
      .then(setStock)
      .catch((error) =>
        toast.error(error instanceof Error ? error.message : "Could not load stock"),
      )
      .finally(() => setLoading(false));
  }, []);

  const results = useMemo(() => {
    const term = search.trim().toLowerCase();
    const inStock = stock.filter((item) => stockLeft(item) > 0);
    const pool = term
      ? inStock.filter((item) =>
          [item.sku, item.name, item.size, item.color, item.category]
            .join(" ")
            .toLowerCase()
            .includes(term),
        )
      : inStock;
    return pool.slice(0, term ? 40 : 12);
  }, [stock, search]);

  const subtotal = useMemo(
    () => round2(lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0)),
    [lines],
  );
  const cost = useMemo(
    () => round2(lines.reduce((sum, line) => sum + line.qty * line.unitCost, 0)),
    [lines],
  );
  const discountValue = Math.max(Number.isFinite(Number(discount)) ? Number(discount) : 0, 0);
  const feeValue = Math.max(Number.isFinite(Number(deliveryFee)) ? Number(deliveryFee) : 0, 0);
  const total = round2(Math.max(subtotal - discountValue + feeValue, 0));
  const paid =
    paidInput === "" || !Number.isFinite(Number(paidInput))
      ? 0
      : Math.max(Number(paidInput), 0);
  const balance = round2(Math.max(total - paid, 0));
  const profit = round2(subtotal - discountValue - cost);

  const addItem = (item: StockItem) => {
    setLines((current) => {
      const existing = current.find((line) => line.stockItemId === item.id);
      const available = stockLeft(item);
      if (existing) {
        if (existing.qty >= available) {
          toast.error(`Only ${available} left of ${item.name} ${item.size}`);
          return current;
        }
        return current.map((line) =>
          line.stockItemId === item.id ? { ...line, qty: line.qty + 1 } : line,
        );
      }
      return [
        ...current,
        {
          stockItemId: item.id,
          sku: item.sku,
          name: item.name,
          size: item.size,
          color: item.color,
          qty: 1,
          unitPrice: item.price,
          unitCost: item.cost,
          available,
        },
      ];
    });
  };

  const addCustomLine = () => {
    const price = Number(customPrice);
    if (!customName.trim()) return toast.error("Enter a name for the item");
    if (!Number.isFinite(price) || price <= 0) return toast.error("Enter a valid price");
    setLines((current) => [
      ...current,
      {
        stockItemId: null,
        sku: "—",
        name: customName.trim(),
        size: "",
        color: "",
        qty: 1,
        unitPrice: round2(price),
        unitCost: 0,
        available: null,
      },
    ]);
    setCustomName("");
    setCustomPrice("");
  };

  const changeQty = (index: number, delta: number) => {
    setLines((current) =>
      current.flatMap((line, position) => {
        if (position !== index) return [line];
        const next = line.qty + delta;
        if (next <= 0) return [];
        if (line.available !== null && next > line.available) {
          toast.error(`Only ${line.available} left of ${line.name}`);
          return [line];
        }
        return [{ ...line, qty: next }];
      }),
    );
  };

  const setLinePrice = (index: number, value: string) => {
    const price = Number(value);
    const safePrice = Number.isFinite(price) && price >= 0 ? price : 0;
    setLines((current) =>
      current.map((line, position) =>
        position === index ? { ...line, unitPrice: safePrice } : line,
      ),
    );
  };

  const removeLine = (index: number) => {
    setLines((current) => current.filter((_, position) => position !== index));
  };

  const resetForm = () => {
    setLines([]);
    setCustomerName("");
    setPhone("");
    setAddress("");
    setCity("");
    setDeliveryFee("0");
    setDiscount("0");
    setPaidInput("");
    setNote("");
    setChannel("walk-in");
    setDeliveryMethod("Pickup");
    setSoldAt(today());
  };

  const save = async (goToSales: boolean) => {
    if (lines.length === 0) return toast.error("Add at least one item");
    if (channel === "booking" && !customerName.trim()) {
      return toast.error("A booking needs a customer name");
    }

    setSaving(true);
    try {
      const sale = await recordSale({
        soldAt,
        customerName,
        phone,
        address,
        city,
        channel,
        deliveryMethod,
        deliveryFee: feeValue,
        deliveryStatus: deliveryMethod === "Pickup" ? "delivered" : "preparing",
        discount: discountValue,
        paid,
        paymentMethod,
        note,
        items: lines.map((line) => ({
          stockItemId: line.stockItemId,
          name: line.name,
          size: line.size,
          color: line.color,
          qty: line.qty,
          unitPrice: line.unitPrice,
          unitCost: line.unitCost,
        })),
      });

      toast.success(
        balance > 0
          ? `${sale.code} saved — ${formatPrice(balance)} still owed`
          : `${sale.code} saved — paid in full`,
      );
      resetForm();
      setStock(await listStockItems());
      if (goToSales) void navigate({ to: "/admin/sales" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the sale");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell
      title="New sale"
      description="Pick items, take the money, stock and the cash book update themselves."
    >
      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        {/* ── Item picker ─────────────────────────────────────────── */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Choose items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Search SKU, name, size, colour…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  autoFocus
                />
              </div>

              {loading ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Loading stock…</p>
              ) : results.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nothing in stock matches “{search}”.
                </p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {results.map((item) => {
                    const left = stockLeft(item);
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => addItem(item)}
                          className="w-full rounded-lg border p-3 text-left transition-colors hover:border-primary hover:bg-muted/50"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium leading-tight">{item.name}</span>
                            <span className="whitespace-nowrap text-sm font-semibold tabular-nums">
                              {formatPrice(item.price)}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{[item.size, item.color].filter(Boolean).join(" · ")}</span>
                            <Badge
                              variant="outline"
                              className={
                                left <= 1
                                  ? "border-amber-200 text-amber-700"
                                  : "text-muted-foreground"
                              }
                            >
                              {left} left
                            </Badge>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="rounded-lg border border-dashed p-3">
                <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                  Not in the stock list?
                </p>
                <div className="flex flex-wrap gap-2">
                  <Input
                    className="min-w-[160px] flex-1"
                    placeholder="Item name"
                    value={customName}
                    onChange={(event) => setCustomName(event.target.value)}
                  />
                  <Input
                    className="w-24"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Price"
                    value={customPrice}
                    onChange={(event) => setCustomPrice(event.target.value)}
                  />
                  <Button variant="outline" onClick={addCustomLine}>
                    <Plus className="mr-1 h-4 w-4" />
                    Add
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Sold as a one-off — it will not change stock counts.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Cart + payment ──────────────────────────────────────── */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingCart className="h-4 w-4" />
                This sale
                {lines.length > 0 ? (
                  <Badge variant="secondary">
                    {lines.length} line{lines.length > 1 ? "s" : ""}
                  </Badge>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lines.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No items yet — pick from the list on the left.
                </p>
              ) : (
                <ul className="space-y-2">
                  {lines.map((line, index) => (
                    <li
                      key={`${line.stockItemId ?? "custom"}-${index}`}
                      className="rounded-md border p-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{line.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {[line.sku, line.size, line.color]
                              .filter((part) => part && part !== "—")
                              .join(" · ") || "one-off item"}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLine(index)}
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Remove {line.name}</span>
                        </Button>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="sm" onClick={() => changeQty(index, -1)}>
                            <Minus className="h-3 w-3" />
                            <span className="sr-only">Less</span>
                          </Button>
                          <span className="w-8 text-center text-sm tabular-nums">{line.qty}</span>
                          <Button variant="outline" size="sm" onClick={() => changeQty(index, 1)}>
                            <Plus className="h-3 w-3" />
                            <span className="sr-only">More</span>
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">×</span>
                          <Input
                            className="h-8 w-20 text-right"
                            type="number"
                            step="0.01"
                            min="0"
                            value={line.unitPrice}
                            onChange={(event) => setLinePrice(index, event.target.value)}
                            aria-label={`Unit price for ${line.name}`}
                          />
                          <span className="w-20 text-right text-sm font-medium tabular-nums">
                            {formatPrice(line.qty * line.unitPrice)}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="grid grid-cols-2 gap-3 border-t pt-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="discount" className="text-xs">
                    Discount
                  </Label>
                  <Input
                    id="discount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={discount}
                    onChange={(event) => setDiscount(event.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="delivery-fee" className="text-xs">
                    Delivery fee
                  </Label>
                  <Input
                    id="delivery-fee"
                    type="number"
                    step="0.01"
                    min="0"
                    value={deliveryFee}
                    onChange={(event) => setDeliveryFee(event.target.value)}
                  />
                </div>
              </div>

              <dl className="space-y-1 border-t pt-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Items</dt>
                  <dd className="tabular-nums">{formatPrice(subtotal)}</dd>
                </div>
                {discountValue > 0 ? (
                  <div className="flex justify-between text-amber-700">
                    <dt>Discount</dt>
                    <dd className="tabular-nums">−{formatPrice(discountValue)}</dd>
                  </div>
                ) : null}
                {feeValue > 0 ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Delivery</dt>
                    <dd className="tabular-nums">{formatPrice(feeValue)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between border-t pt-1 text-base font-semibold">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{formatPrice(total)}</dd>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <dt>Profit on this sale</dt>
                  <dd className="tabular-nums text-emerald-600">{formatPrice(profit)}</dd>
                </div>
              </dl>

              <div className="space-y-2 border-t pt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="paid" className="text-xs">
                      Received now
                    </Label>
                    <Input
                      id="paid"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={paidInput}
                      onChange={(event) => setPaidInput(event.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Payment method</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((method) => (
                          <SelectItem key={method} value={method}>
                            {method}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPaidInput(String(total))}
                    disabled={total <= 0}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" />
                    Paid in full
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPaidInput(String(round2(total / 2)))}
                    disabled={total <= 0}
                  >
                    Half deposit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPaidInput("")}>
                    <X className="mr-1 h-3.5 w-3.5" />
                    Nothing yet
                  </Button>
                </div>
                {balance > 0 ? (
                  <p className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Balance owed {formatPrice(balance)} — this sale stays in the unpaid list.
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Customer &amp; delivery</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="sold-at" className="text-xs">
                    Date
                  </Label>
                  <Input
                    id="sold-at"
                    type="date"
                    value={soldAt}
                    onChange={(event) => setSoldAt(event.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={channel}
                    onValueChange={(value) => setChannel(value as SaleChannel)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="walk-in">Walk-in</SelectItem>
                      <SelectItem value="booking">Booking / deposit</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="customer" className="text-xs">
                    Customer name
                  </Label>
                  <Input
                    id="customer"
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder="Walk-in customer"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="phone" className="text-xs">
                    Phone / Telegram
                  </Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs">Delivery method</Label>
                  <Select value={deliveryMethod} onValueChange={setDeliveryMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DELIVERY_METHODS.map((method) => (
                        <SelectItem key={method} value={method}>
                          {method}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="city" className="text-xs">
                    City / area
                  </Label>
                  <Input
                    id="city"
                    list="city-options"
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                  />
                  <datalist id="city-options">
                    {CITY_SUGGESTIONS.map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                </div>
              </div>

              {deliveryMethod !== "Pickup" ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="address" className="text-xs">
                    Address
                  </Label>
                  <Textarea
                    id="address"
                    rows={2}
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                  />
                </div>
              ) : null}

              <div className="grid gap-1.5">
                <Label htmlFor="note" className="text-xs">
                  Note (optional)
                </Label>
                <Input id="note" value={note} onChange={(event) => setNote(event.target.value)} />
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button
              className="flex-1"
              size="lg"
              onClick={() => save(false)}
              disabled={saving || lines.length === 0}
            >
              {saving ? "Saving…" : `Save sale · ${formatPrice(total)}`}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => save(true)}
              disabled={saving || lines.length === 0}
            >
              Save &amp; view sales
            </Button>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
