import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertTriangle,
  Check,
  Minus,
  Plus,
  Printer,
  QrCode,
  Search,
  Share2,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { generateBakongQR, getBakongPaymentConfig, isValidBakongAccount } from "@/lib/bakong";
import { lowStockAfterSale, saleAlertText, sendOwnerAlert } from "@/lib/pos/alerts";
import { printSaleReceipt, saleReceiptHtml, shareSaleReceipt } from "@/lib/pos/receipt";
import { listStockItems, recordSale } from "@/lib/pos/store";
import {
  PAYMENT_METHODS,
  localDate,
  round2,
  stockLeft,
  type Sale,
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

/** One product on the picker, with all its size/colour variants (stock items). */
interface ProductGroup {
  key: string;
  name: string;
  variants: StockItem[];
}

/** Variants are the stock items linked to the same product, or sharing a name + category. */
const groupKey = (item: StockItem) =>
  item.productId ?? `${item.name.trim().toLowerCase()}|${item.category.trim().toLowerCase()}`;

const priceLabel = (variants: StockItem[]) => {
  const prices = variants.map((variant) => variant.price);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  return low === high ? formatPrice(low) : `${formatPrice(low)}–${formatPrice(high)}`;
};

const DELIVERY_METHODS = ["Pickup", "Delivery", "VET Express", "J&T", "Grab", "Other"];
const CITY_SUGGESTIONS = [
  "Phnom Penh",
  "Battambang",
  "Siem Reap",
  "Sihanoukville",
  "Kampong Speu",
  "Kampong Cham",
];

const today = () => localDate();

/** Banknotes customers usually pay with, used for the quick "customer gave" buttons. */
const NOTE_STEPS = [5, 10, 20, 50, 100];

/** Round amounts just above the total (e.g. $37 → $40, $50, $100). */
function cashSuggestions(total: number): number[] {
  if (total <= 0) return [];
  const amounts = new Set<number>();
  for (const step of NOTE_STEPS) {
    const rounded = Math.ceil(total / step) * step;
    if (rounded > total) amounts.add(rounded);
  }
  return [...amounts].sort((a, b) => a - b).slice(0, 4);
}

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
    const byKey = new Map<string, ProductGroup>();
    for (const item of stock) {
      const key = groupKey(item);
      const group = byKey.get(key);
      if (group) group.variants.push(item);
      else byKey.set(key, { key, name: item.name, variants: [item] });
    }
    const pool = [...byKey.values()].filter((group) => {
      if (!group.variants.some((variant) => stockLeft(variant) > 0)) return false;
      if (!term) return true;
      return group.variants.some((variant) =>
        [variant.sku, variant.name, variant.size, variant.color, variant.category]
          .join(" ")
          .toLowerCase()
          .includes(term),
      );
    });
    return pool.slice(0, term ? 40 : 12);
  }, [stock, search]);

  const [pickerGroup, setPickerGroup] = useState<ProductGroup | null>(null);
  const checkoutRef = useRef<HTMLDListElement>(null);
  const itemCount = lines.reduce((sum, line) => sum + line.qty, 0);

  const openGroup = (group: ProductGroup) => {
    // A product with a single variant goes straight into the cart.
    if (group.variants.length === 1) addItem(group.variants[0]);
    else setPickerGroup(group);
  };

  const pickVariant = (item: StockItem) => {
    addItem(item);
    setPickerGroup(null);
  };

  /** Variants of the open product, grouped by colour, sizes in their stock-list order. */
  const pickerSections = useMemo(() => {
    if (!pickerGroup) return [];
    const sections = new Map<string, StockItem[]>();
    for (const variant of pickerGroup.variants) {
      const colour = variant.color.trim();
      sections.set(colour, [...(sections.get(colour) ?? []), variant]);
    }
    return [...sections.entries()];
  }, [pickerGroup]);

  const inCart = (item: StockItem) => lines.find((line) => line.stockItemId === item.id)?.qty ?? 0;

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
  const received =
    paidInput === "" || !Number.isFinite(Number(paidInput)) ? 0 : Math.max(Number(paidInput), 0);
  // Only the sale total goes into the cash book; anything above it is change handed back.
  const paid = round2(Math.min(received, total));
  const change = round2(Math.max(received - total, 0));
  const balance = round2(Math.max(total - paid, 0));

  /** The sale just saved, kept so the cashier can print or share its receipt. */
  const [lastSale, setLastSale] = useState<{
    sale: Sale;
    cashGiven: number;
    change: number;
  } | null>(null);
  const profit = round2(subtotal - discountValue - cost);

  /** KHQR shown to the customer: the amount is baked into the code. */
  const [khqr, setKhqr] = useState<{ amount: number; qr: string; expiresAt: number } | null>(null);
  const bakong = getBakongPaymentConfig();
  const bakongReady = isValidBakongAccount(bakong.merchantAccount);

  const openKhqr = () => {
    // Charge what was typed in "Received now" (e.g. a deposit), otherwise the full total.
    const amount = paid > 0 ? paid : total;
    if (amount <= 0) return toast.error("Add items first");
    const minutes = 10;
    setKhqr({
      amount,
      qr: generateBakongQR(bakong, {
        amount,
        currency: "USD",
        storeLabel: "BillieGrace POS",
        expiresInMinutes: minutes,
      }),
      expiresAt: Date.now() + minutes * 60 * 1000,
    });
  };

  const confirmKhqrPaid = () => {
    if (!khqr) return;
    setPaymentMethod("Bakong/KHQR");
    setPaidInput(String(khqr.amount));
    setKhqr(null);
    toast.success(`${formatPrice(khqr.amount)} KHQR payment noted — now save the sale`);
  };

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
      const freshStock = await listStockItems();
      setStock(freshStock);
      // Owner alert on Telegram; runs in the background and never blocks the till.
      void sendOwnerAlert(saleAlertText(sale, lowStockAfterSale(sale, freshStock)));
      if (goToSales) void navigate({ to: "/admin/sales" });
      else setLastSale({ sale, cashGiven: change > 0 ? received : 0, change });
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
      <div
        className={`grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_1fr] ${lines.length > 0 ? "pb-24 lg:pb-0" : ""}`}
      >
        {/* ── Item picker ─────────────────────────────────────────── */}
        <div className="min-w-0 space-y-4">
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
                  {search.trim() ? `Nothing in stock matches “${search}”.` : "Nothing in stock."}
                </p>
              ) : (
                <ul className="grid grid-cols-2 gap-2">
                  {results.map((group) => {
                    const inStock = group.variants.filter((variant) => stockLeft(variant) > 0);
                    const left = inStock.reduce((sum, variant) => sum + stockLeft(variant), 0);
                    const options =
                      group.variants.length === 1
                        ? [group.variants[0].size, group.variants[0].color]
                            .filter(Boolean)
                            .join(" · ")
                        : [...new Set(inStock.map((variant) => variant.size).filter(Boolean))].join(
                            " · ",
                          );
                    return (
                      <li key={group.key}>
                        <button
                          type="button"
                          onClick={() => openGroup(group)}
                          className="h-full w-full rounded-lg border p-3 text-left transition-colors hover:border-primary hover:bg-muted/50 active:bg-muted"
                        >
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
                            <span className="min-w-0 break-words text-sm font-medium leading-tight">
                              {group.name}
                            </span>
                            <span className="whitespace-nowrap text-sm font-semibold tabular-nums">
                              {priceLabel(group.variants)}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            {options ? <span className="break-words">{options}</span> : null}
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
        <div className="min-w-0 space-y-4">
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
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
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

              <dl ref={checkoutRef} className="scroll-mt-4 space-y-1 border-t pt-3 text-sm">
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
                {paymentMethod === "Bakong/KHQR" && total > 0 ? (
                  <Button
                    className="w-full"
                    variant="secondary"
                    onClick={openKhqr}
                    disabled={!bakongReady}
                    title={bakongReady ? undefined : "Set VITE_BAKONG_MERCHANT_ACCOUNT first"}
                  >
                    <QrCode className="mr-2 h-4 w-4" />
                    Show KHQR for {formatPrice(paid > 0 ? paid : total)}
                  </Button>
                ) : null}
                {paymentMethod === "cash" && total > 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">Customer gave:</span>
                    {cashSuggestions(total).map((amount) => (
                      <Button
                        key={amount}
                        variant={received === amount ? "default" : "secondary"}
                        size="sm"
                        onClick={() => setPaidInput(String(amount))}
                      >
                        {formatPrice(amount)}
                      </Button>
                    ))}
                  </div>
                ) : null}
                {change > 0 ? (
                  <div className="flex items-center justify-between rounded-md bg-emerald-50 px-3 py-2 text-emerald-900">
                    <span className="text-sm font-medium">Change to give back</span>
                    <span className="text-xl font-bold tabular-nums">{formatPrice(change)}</span>
                  </div>
                ) : null}
                {balance > 0 ? (
                  <p className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Balance owed {formatPrice(balance)} — this sale stays in the unpaid list.
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2 border-t pt-3">
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
        </div>
      </div>

      {/* ── Phone/tablet pay bar: always within thumb reach ────────── */}
      {lines.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 pt-3 backdrop-blur pb-[calc(env(safe-area-inset-bottom)+0.75rem)] lg:hidden">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                {itemCount} item{itemCount === 1 ? "" : "s"}
                {balance > 0 && paid > 0 ? ` · ${formatPrice(balance)} owed` : ""}
                {change > 0 ? ` · change ${formatPrice(change)}` : ""}
              </p>
              <p className="text-lg font-semibold tabular-nums">{formatPrice(total)}</p>
            </div>
            <Button
              size="lg"
              className="shrink-0"
              onClick={() =>
                checkoutRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              Checkout
            </Button>
          </div>
        </div>
      ) : null}

      {/* ── Size / colour picker ───────────────────────────────────── */}
      <Dialog open={pickerGroup !== null} onOpenChange={(open) => !open && setPickerGroup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="pr-6">{pickerGroup?.name}</DialogTitle>
            <DialogDescription>Tap a size to add it to the sale.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {pickerSections.map(([colour, variants]) => (
              <div key={colour || "-"}>
                {pickerSections.length > 1 || colour ? (
                  <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                    {colour || "No colour"}
                  </p>
                ) : null}
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {variants.map((variant) => {
                    const left = stockLeft(variant);
                    const taken = inCart(variant);
                    const soldOut = left - taken <= 0;
                    const showPrice = new Set(pickerGroup?.variants.map((v) => v.price)).size > 1;
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        disabled={soldOut}
                        onClick={() => pickVariant(variant)}
                        className="flex min-h-16 flex-col items-center justify-center rounded-lg border p-2 text-center transition-colors hover:border-primary hover:bg-muted/50 active:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <span className="text-base font-semibold">
                          {variant.size || "One size"}
                        </span>
                        {showPrice ? (
                          <span className="text-xs tabular-nums">{formatPrice(variant.price)}</span>
                        ) : null}
                        <span
                          className={`text-xs ${left <= 1 && !soldOut ? "text-amber-700" : "text-muted-foreground"}`}
                        >
                          {left <= 0 ? "Sold out" : soldOut ? "All in cart" : `${left} left`}
                          {taken > 0 && !soldOut ? ` · ${taken} in cart` : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── After saving: receipt ──────────────────────────────────── */}
      <Dialog open={lastSale !== null} onOpenChange={(open) => !open && setLastSale(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="pr-6">Sale {lastSale?.sale.code} saved</DialogTitle>
            <DialogDescription>
              {lastSale
                ? `Total ${formatPrice(lastSale.sale.total)} · paid ${formatPrice(lastSale.sale.paid)} by ${lastSale.sale.paymentMethod}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {lastSale && lastSale.change > 0 ? (
            <div className="flex items-center justify-between rounded-md bg-emerald-50 px-3 py-3 text-emerald-900">
              <span className="font-medium">Give change</span>
              <span className="text-2xl font-bold tabular-nums">
                {formatPrice(lastSale.change)}
              </span>
            </div>
          ) : null}
          {lastSale && lastSale.sale.total - lastSale.sale.paid > 0 ? (
            <p className="flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertTriangle className="h-4 w-4" />
              Still owed {formatPrice(round2(lastSale.sale.total - lastSale.sale.paid))}
            </p>
          ) : null}
          {lastSale ? (
            <div className="rounded-md border bg-white p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Receipt preview
                </span>
                <span className="text-xs text-muted-foreground">80mm thermal</span>
              </div>
              <div className="max-h-80 overflow-auto rounded border bg-white">
                <div
                  className="receipt-paper"
                  dangerouslySetInnerHTML={{
                    __html: saleReceiptHtml(lastSale.sale, { cashGiven: lastSale.cashGiven }),
                  }}
                />
              </div>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                if (!lastSale) return;
                try {
                  printSaleReceipt(lastSale.sale, { cashGiven: lastSale.cashGiven });
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Could not print the receipt",
                  );
                }
              }}
            >
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={async () => {
                if (!lastSale) return;
                try {
                  const result = await shareSaleReceipt(lastSale.sale, {
                    cashGiven: lastSale.cashGiven,
                  });
                  if (result === "copied") {
                    toast.success("Receipt copied — paste it in your printer app or a chat");
                  }
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Could not share the receipt",
                  );
                }
              }}
            >
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
          </div>
          <Button size="lg" onClick={() => setLastSale(null)}>
            New sale
          </Button>
        </DialogContent>
      </Dialog>

      {/* ── KHQR for the customer to scan ─────────────────────────── */}
      <Dialog open={khqr !== null} onOpenChange={(open) => !open && setKhqr(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="pr-6">
              Scan to pay {khqr ? formatPrice(khqr.amount) : ""}
            </DialogTitle>
            <DialogDescription>
              Any Cambodian banking app (ABA, ACLEDA, Wing, Bakong…). The amount is already filled
              in.
            </DialogDescription>
          </DialogHeader>
          {khqr ? (
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-xl border-4 border-red-600 bg-white p-4">
                <QRCodeSVG value={khqr.qr} size={240} level="M" marginSize={0} />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold">{bakong.merchantName}</p>
                <p className="text-xs text-muted-foreground">{bakong.merchantAccount}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Valid until{" "}
                  {new Date(khqr.expiresAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Check the payment arrived in your bank app before tapping “Customer paid”.
              </p>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="lg" onClick={() => setKhqr(null)}>
              Cancel
            </Button>
            <Button size="lg" onClick={confirmKhqrPaid}>
              <Check className="mr-2 h-4 w-4" />
              Customer paid
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
