import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Ban,
  Banknote,
  ChevronDown,
  ChevronRight,
  Download,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { StatCard } from "@/components/admin/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPrice } from "@/lib/format";
import { printEndOfDayReport, printSaleReceipt } from "@/lib/pos/receipt";
import {
  addFinanceEntry,
  addSalePayment,
  cancelSale,
  downloadFile,
  listFinanceEntries,
  listSales,
  toCsv,
  updateSale,
} from "@/lib/pos/store";
import {
  PAYMENT_METHODS,
  balanceOwed,
  paymentState,
  round2,
  saleProfit,
  type DeliveryStatus,
  type FinanceEntry,
  type Sale,
} from "@/lib/pos/types";

export const Route = createFileRoute("/admin/sales")({
  head: () => ({ meta: [{ title: "Sales - Admin" }] }),
  component: SalesPage,
});

const DELIVERY_STATUSES: DeliveryStatus[] = ["preparing", "sent", "delivered", "returned"];

/** How many of the most recent sales to load — the list view isn't paginated yet. */
const SALES_LOAD_LIMIT = 300;

const PAYMENT_BADGE: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-800",
  deposit: "bg-amber-100 text-amber-800",
  unpaid: "bg-red-100 text-red-800",
};

const PAYMENT_LABEL: Record<string, string> = {
  paid: "Paid",
  deposit: "Deposit",
  unpaid: "Not paid",
};

function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "owing" | "preparing" | "cancelled">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const [payTarget, setPayTarget] = useState<Sale | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<string>("cash");
  const [saving, setSaving] = useState(false);

  // ── End-of-day cash up (drawer reconciliation) ──
  const [cashUpOpen, setCashUpOpen] = useState(false);
  const [cashDate, setCashDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [openingFloat, setOpeningFloat] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("pos-opening-float") ?? "" : "",
  );
  const [countedCash, setCountedCash] = useState("");
  const [financeEntries, setFinanceEntries] = useState<FinanceEntry[]>([]);
  const [cashLoading, setCashLoading] = useState(false);
  const [posting, setPosting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setSales(await listSales(SALES_LOAD_LIMIT));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load sales");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sales.filter((sale) => {
      if (filter === "owing" && (sale.status === "cancelled" || balanceOwed(sale) <= 0))
        return false;
      if (filter === "preparing" && sale.deliveryStatus !== "preparing") return false;
      if (filter === "cancelled" && sale.status !== "cancelled") return false;
      if (filter !== "cancelled" && filter !== "all" && sale.status === "cancelled") return false;
      if (!term) return true;
      return [sale.code, sale.customerName, sale.phone, sale.city, ...sale.items.map((i) => i.name)]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [sales, search, filter]);

  const totals = useMemo(() => {
    const live = sales.filter((sale) => sale.status === "confirmed");
    return {
      count: live.length,
      billed: round2(live.reduce((sum, sale) => sum + sale.total, 0)),
      collected: round2(live.reduce((sum, sale) => sum + sale.paid, 0)),
      owing: round2(live.reduce((sum, sale) => sum + balanceOwed(sale), 0)),
      owingCount: live.filter((sale) => balanceOwed(sale) > 0).length,
      profit: round2(live.reduce((sum, sale) => sum + saleProfit(sale), 0)),
    };
  }, [sales]);

  const openPayment = (sale: Sale) => {
    setPayTarget(sale);
    setPayAmount(String(balanceOwed(sale)));
    setPayMethod(sale.paymentMethod || "cash");
  };

  const submitPayment = async () => {
    if (!payTarget) return;
    const amount = Number(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("Enter a valid amount");

    setSaving(true);
    try {
      await addSalePayment(payTarget.id, round2(amount), payMethod);
      toast.success(`${formatPrice(amount)} recorded for ${payTarget.code}`);
      setPayTarget(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record the payment");
    } finally {
      setSaving(false);
    }
  };

  const changeDelivery = async (sale: Sale, status: DeliveryStatus) => {
    try {
      await updateSale(sale.id, { deliveryStatus: status });
      setSales((current) =>
        current.map((row) => (row.id === sale.id ? { ...row, deliveryStatus: status } : row)),
      );
      toast.success(`${sale.code} marked ${status}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the sale");
    }
  };

  const doCancel = async (sale: Sale) => {
    if (
      !window.confirm(
        `Cancel ${sale.code}? Stock goes back on the shelf and any money received is recorded as a refund.`,
      )
    ) {
      return;
    }
    try {
      await cancelSale(sale.id);
      toast.success(`${sale.code} cancelled`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not cancel the sale");
    }
  };

  const doPrintReceipt = (sale: Sale) => {
    try {
      printSaleReceipt(sale);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open the print window");
    }
  };

  const cashUp = useMemo(() => {
    const daySales = sales.filter(
      (sale) => sale.status === "confirmed" && sale.soldAt === cashDate,
    );
    const float = Number.parseFloat(openingFloat) || 0;
    const byMethod = new Map<string, number>();
    let cashIn = 0;
    let cashOut = 0;
    let refunds = 0;
    for (const entry of financeEntries) {
      if (entry.entryDate !== cashDate) continue;
      byMethod.set(
        entry.method,
        (byMethod.get(entry.method) ?? 0) + (entry.kind === "income" ? entry.amount : -entry.amount),
      );
      if (entry.method === "cash") {
        if (entry.kind === "income") cashIn += entry.amount;
        else cashOut += entry.amount;
      }
      if (entry.kind === "expense" && entry.category === "Refund") refunds += entry.amount;
    }
    const counted =
      countedCash.trim() === "" ? null : Number.parseFloat(countedCash);
    return {
      salesCount: daySales.length,
      billed: round2(daySales.reduce((sum, sale) => sum + sale.total, 0)),
      byMethod: Array.from(byMethod.entries()).sort((a, b) => b[1] - a[1]),
      refunds: round2(refunds),
      float: round2(float),
      cashIn: round2(cashIn),
      cashOut: round2(cashOut),
      expectedCash: round2(float + cashIn - cashOut),
      counted: counted !== null && Number.isFinite(counted) ? round2(counted) : null,
    };
  }, [sales, financeEntries, cashDate, openingFloat, countedCash]);

  const cashDifference =
    cashUp.counted === null ? null : round2(cashUp.counted - cashUp.expectedCash);

  const openCashUp = async () => {
    setCashUpOpen(true);
    setCashLoading(true);
    try {
      setFinanceEntries(await listFinanceEntries());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load cash movements");
    } finally {
      setCashLoading(false);
    }
  };

  const printCashUp = () => {
    try {
      localStorage.setItem("pos-opening-float", openingFloat);
      printEndOfDayReport({
        date: cashDate,
        salesCount: cashUp.salesCount,
        billed: cashUp.billed,
        collectedByMethod: cashUp.byMethod.map(([method, amount]) => ({ method, amount })),
        refunds: cashUp.refunds,
        openingFloat: cashUp.float,
        cashIn: cashUp.cashIn,
        cashOut: cashUp.cashOut,
        expectedCash: cashUp.expectedCash,
        countedCash: cashUp.counted,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open the print window");
    }
  };

  const postDifference = async () => {
    if (cashDifference === null || Math.abs(cashDifference) < 0.005) return;
    setPosting(true);
    try {
      const entry = await addFinanceEntry({
        entryDate: cashDate,
        kind: cashDifference > 0 ? "income" : "expense",
        description: `Cash up adjustment (${cashDifference > 0 ? "extra cash" : "shortage"})`,
        category: "Other",
        amount: round2(Math.abs(cashDifference)),
        method: "cash",
      });
      setFinanceEntries((current) => [entry, ...current]);
      localStorage.setItem("pos-opening-float", openingFloat);
      toast.success("Adjustment recorded in the cash book");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record the adjustment");
    } finally {
      setPosting(false);
    }
  };

  const exportCsv = () => {
    downloadFile(
      `sales-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        sales.flatMap((sale) =>
          sale.items.map((item) => ({
            Code: sale.code,
            Date: sale.soldAt,
            Customer: sale.customerName,
            Phone: sale.phone,
            City: sale.city,
            Item: item.name,
            Size: item.size,
            Qty: item.qty,
            "Unit price": item.unitPrice,
            "Unit cost": item.unitCost,
            "Line total": round2(item.qty * item.unitPrice),
            "Sale total": sale.total,
            Paid: sale.paid,
            Balance: balanceOwed(sale),
            "Delivery fee": sale.deliveryFee,
            "Delivery status": sale.deliveryStatus,
            Status: sale.status,
          })),
        ),
      ),
      "text/csv",
    );
  };

  return (
    <AdminShell
      title="Sales"
      description="Every sale and booking, who still owes money, and what each one earned."
      actions={
        <>
          <Button variant="outline" size="sm" onClick={openCashUp}>
            <Banknote className="mr-2 h-4 w-4" />
            Cash up
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" asChild>
            <Link to="/admin/pos">
              <Plus className="mr-2 h-4 w-4" />
              New sale
            </Link>
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Sales" value={String(totals.count)} hint="Not cancelled" />
        <StatCard label="Billed" value={formatPrice(totals.billed)} hint="Items + delivery" />
        <StatCard
          label="Collected"
          value={formatPrice(totals.collected)}
          hint="Cash actually received"
          tone="good"
        />
        <StatCard
          label="Still owed"
          value={formatPrice(totals.owing)}
          hint={`${totals.owingCount} customer${totals.owingCount === 1 ? "" : "s"}`}
          icon={Wallet}
          tone={totals.owing > 0 ? "warn" : "default"}
        />
      </div>

      <Card className="mt-6">
        <CardContent className="space-y-4 pt-6">
          {sales.length >= SALES_LOAD_LIMIT ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Showing the most recent {SALES_LOAD_LIMIT} sales. Older sales exist but aren't loaded — narrow your search or export a date range from Money → CSV.
            </p>
          ) : null}
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <Label htmlFor="sales-search" className="text-xs text-muted-foreground">
                Search
              </Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="sales-search"
                  className="pl-8"
                  placeholder="Code, customer, phone, item…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Show</Label>
              <Select value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
                <SelectTrigger className="w-[190px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sales</SelectItem>
                  <SelectItem value="owing">Money still owed</SelectItem>
                  <SelectItem value="preparing">To prepare / send</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading sales…</p>
          ) : visible.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No sales match this filter.
            </p>
          ) : (
            <ul className="divide-y">
              {visible.map((sale) => {
                const owed = balanceOwed(sale);
                const state = paymentState(sale);
                const isOpen = expanded === sale.id;
                return (
                  <li key={sale.id} className="py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : sale.id)}
                        className="flex min-w-0 flex-1 items-start gap-2 text-left"
                        aria-expanded={isOpen}
                      >
                        {isOpen ? (
                          <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground">
                              {sale.code}
                            </span>
                            <span className="font-medium">{sale.customerName}</span>
                            {sale.status === "cancelled" ? (
                              <Badge variant="outline" className="text-muted-foreground">
                                cancelled
                              </Badge>
                            ) : (
                              <Badge className={`border-transparent ${PAYMENT_BADGE[state]}`}>
                                {PAYMENT_LABEL[state]}
                              </Badge>
                            )}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {sale.soldAt} · {sale.items.length} item
                            {sale.items.length > 1 ? "s" : ""} ·{" "}
                            {sale.items.map((item) => item.name).join(", ")}
                          </p>
                        </div>
                      </button>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-semibold tabular-nums">{formatPrice(sale.total)}</p>
                          {owed > 0 && sale.status === "confirmed" ? (
                            <p className="text-xs text-amber-700">owes {formatPrice(owed)}</p>
                          ) : (
                            <p className="text-xs text-emerald-600">
                              +{formatPrice(saleProfit(sale))} profit
                            </p>
                          )}
                        </div>
                        {sale.status === "confirmed" ? (
                          <div className="flex items-center gap-1">
                            {owed > 0 ? (
                              <Button size="sm" variant="outline" onClick={() => openPayment(sale)}>
                                Take payment
                              </Button>
                            ) : null}
                            <Select
                              value={sale.deliveryStatus}
                              onValueChange={(value) =>
                                changeDelivery(sale, value as DeliveryStatus)
                              }
                            >
                              <SelectTrigger className="h-8 w-[130px] text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DELIVERY_STATUSES.map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {status}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {isOpen ? (
                      <div className="mt-3 grid gap-4 rounded-md bg-muted/40 p-3 md:grid-cols-2">
                        <div>
                          <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                            Items
                          </p>
                          <ul className="space-y-1 text-sm">
                            {sale.items.map((item) => (
                              <li key={item.id} className="flex justify-between gap-2">
                                <span>
                                  {item.name}
                                  {item.size ? ` · ${item.size}` : ""}
                                  {item.color ? ` · ${item.color}` : ""} × {item.qty}
                                </span>
                                <span className="tabular-nums">
                                  {formatPrice(item.qty * item.unitPrice)}
                                </span>
                              </li>
                            ))}
                          </ul>
                          <dl className="mt-2 space-y-0.5 border-t pt-2 text-sm">
                            <div className="flex justify-between">
                              <dt className="text-muted-foreground">Items</dt>
                              <dd className="tabular-nums">{formatPrice(sale.subtotal)}</dd>
                            </div>
                            {sale.discount > 0 ? (
                              <div className="flex justify-between">
                                <dt className="text-muted-foreground">Discount</dt>
                                <dd className="tabular-nums">−{formatPrice(sale.discount)}</dd>
                              </div>
                            ) : null}
                            {sale.deliveryFee > 0 ? (
                              <div className="flex justify-between">
                                <dt className="text-muted-foreground">Delivery</dt>
                                <dd className="tabular-nums">{formatPrice(sale.deliveryFee)}</dd>
                              </div>
                            ) : null}
                            <div className="flex justify-between font-medium">
                              <dt>Total</dt>
                              <dd className="tabular-nums">{formatPrice(sale.total)}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-muted-foreground">Received</dt>
                              <dd className="tabular-nums">{formatPrice(sale.paid)}</dd>
                            </div>
                          </dl>
                        </div>

                        <div className="space-y-2 text-sm">
                          <p className="text-xs font-medium uppercase text-muted-foreground">
                            Delivery
                          </p>
                          <p>{sale.phone || "no phone"}</p>
                          <p className="text-muted-foreground">
                            {[sale.deliveryMethod, sale.city].filter(Boolean).join(" · ")}
                          </p>
                          {sale.address ? (
                            <p className="text-muted-foreground">{sale.address}</p>
                          ) : null}
                          {sale.note ? (
                            <p className="italic text-muted-foreground">{sale.note}</p>
                          ) : null}
                          {sale.status === "confirmed" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => doCancel(sale)}
                            >
                              <Ban className="mr-1 h-4 w-4" />
                              Cancel sale
                            </Button>
                          ) : null}
                          <Button variant="ghost" size="sm" onClick={() => doPrintReceipt(sale)}>
                            <Printer className="mr-1 h-4 w-4" />
                            Receipt
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={payTarget !== null} onOpenChange={(open) => !open && setPayTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Take payment</DialogTitle>
            <DialogDescription>
              {payTarget
                ? `${payTarget.code} — ${payTarget.customerName} owes ${formatPrice(balanceOwed(payTarget))}`
                : null}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="pay-amount">Amount received</Label>
              <Input
                id="pay-amount"
                type="number"
                step="0.01"
                min="0"
                value={payAmount}
                onChange={(event) => setPayAmount(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Method</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setPayTarget(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submitPayment} disabled={saving}>
              {saving ? "Saving…" : "Record payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={cashUpOpen}
        onOpenChange={(open) => {
          setCashUpOpen(open);
          if (!open && typeof window !== "undefined") {
            localStorage.setItem("pos-opening-float", openingFloat);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cash up (end of day)</DialogTitle>
            <DialogDescription>
              Count the drawer and check it against what the system expects.
            </DialogDescription>
          </DialogHeader>

          {cashLoading ? (
            <p className="py-4 text-sm text-muted-foreground">Loading cash movements…</p>
          ) : (
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="cash-date">Date</Label>
                  <Input
                    id="cash-date"
                    type="date"
                    value={cashDate}
                    onChange={(event) => setCashDate(event.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cash-float">Opening float</Label>
                  <Input
                    id="cash-float"
                    type="number"
                    step="0.01"
                    min="0"
                    value={openingFloat}
                    onChange={(event) => setOpeningFloat(event.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <dl className="space-y-1 rounded-md bg-muted/50 p-3 text-sm">
                <div className="flex justify-between">
                  <dt>Sales ({cashUp.salesCount})</dt>
                  <dd className="tabular-nums">{formatPrice(cashUp.billed)}</dd>
                </div>
                {cashUp.byMethod.map(([method, amount]) => (
                  <div key={method} className="flex justify-between">
                    <dt className="text-muted-foreground">{method}</dt>
                    <dd className="tabular-nums">{formatPrice(amount)}</dd>
                  </div>
                ))}
                {cashUp.refunds > 0 ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Refunds</dt>
                    <dd className="tabular-nums">−{formatPrice(cashUp.refunds)}</dd>
                  </div>
                ) : null}
              </dl>

              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Cash in</dt>
                  <dd className="tabular-nums">+{formatPrice(cashUp.cashIn)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Cash out</dt>
                  <dd className="tabular-nums">−{formatPrice(cashUp.cashOut)}</dd>
                </div>
                <div className="flex justify-between border-t pt-1 font-medium">
                  <dt>Expected in drawer</dt>
                  <dd className="tabular-nums">{formatPrice(cashUp.expectedCash)}</dd>
                </div>
              </dl>

              <div className="grid gap-1.5">
                <Label htmlFor="cash-counted">Counted cash</Label>
                <Input
                  id="cash-counted"
                  type="number"
                  step="0.01"
                  min="0"
                  value={countedCash}
                  onChange={(event) => setCountedCash(event.target.value)}
                  placeholder="Count the drawer…"
                />
                {cashDifference !== null ? (
                  <p
                    className={`text-xs ${
                      Math.abs(cashDifference) < 0.005 ? "text-emerald-600" : "text-amber-600"
                    }`}
                  >
                    {Math.abs(cashDifference) < 0.005
                      ? "Drawer is exact ✓"
                      : `${cashDifference > 0 ? "Over" : "Short"} ${formatPrice(Math.abs(cashDifference))}`}
                  </p>
                ) : null}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={printCashUp} disabled={cashLoading}>
              <Printer className="mr-2 h-4 w-4" />
              Print report
            </Button>
            {cashDifference !== null && Math.abs(cashDifference) >= 0.005 ? (
              <Button onClick={postDifference} disabled={posting}>
                {posting ? "Saving…" : "Post adjustment"}
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setCashUpOpen(false)}>
                Done
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
