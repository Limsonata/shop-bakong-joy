import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Package,
  Phone,
  Printer,
  RefreshCw,
  Search,
  Truck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { LinkifiedText } from "@/components/site/LinkifiedText";
import {
  cancelUnpaidOrders,
  getAllOrders,
  getOrderPosStates,
  orderNumber,
  retryOrderPosSync,
  updateOrderStatus,
  type Order,
  type OrderPosState,
  type OrderStatus,
  type PosSyncProblem,
} from "@/lib/orderStore";
import { ORDER_STATUS, PAYMENT_METHOD_LABEL, statusFor } from "@/lib/orderStatus";
import { checkOrderPayment } from "@/lib/api/payway.functions";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/orders")({
  head: () => ({ meta: [{ title: "Orders - Admin" }] }),
  component: OrdersAdmin,
});

const STATUS_OPTIONS: OrderStatus[] = ["pending", "paid", "shipped", "done", "cancelled"];

type TabId = "to_pay" | "to_pack" | "shipped" | "done" | "cancelled" | "all" | "pos";

const POS_PROBLEM_LABEL: Record<PosSyncProblem, { badge: string; detail: string }> = {
  missing_sale: {
    badge: "Not in POS",
    detail: "No POS sale yet: stock was not deducted and the money is not in the cash book.",
  },
  not_cancelled: {
    badge: "POS sale still open",
    detail:
      "The order is cancelled but its POS sale is not: stock was not returned and no refund was posted.",
  },
  delivery_behind: {
    badge: "POS delivery behind",
    detail: "The POS sale's delivery status is behind this order's status.",
  },
};

/** Orders that need attention on the POS side: a sync problem or items with no stock row. */
function needsPosAttention(state: OrderPosState | undefined): boolean {
  return Boolean(state && (state.problem || state.unmatchedItems.length > 0));
}

const TABS: Array<{ id: TabId; label: string; match: (o: Order) => boolean }> = [
  {
    id: "to_pay",
    label: "To pay",
    match: (o) => o.status === "pending" && o.paymentMethod !== "cod",
  },
  {
    id: "to_pack",
    label: "To pack & send",
    match: (o) => o.status === "paid" || (o.status === "pending" && o.paymentMethod === "cod"),
  },
  { id: "shipped", label: "On the way", match: (o) => o.status === "shipped" },
  { id: "done", label: "Done", match: (o) => o.status === "done" },
  { id: "cancelled", label: "Cancelled", match: (o) => o.status === "cancelled" },
  { id: "all", label: "All", match: () => true },
];

function money(amount: number, currency: string) {
  return currency.toUpperCase() === "USD"
    ? `$${amount.toFixed(2)}`
    : `${amount.toFixed(0)} ${currency}`;
}

/** The one obvious next step for an order. */
function nextAction(
  order: Order,
): { label: string; status: OrderStatus; icon: typeof Truck } | null {
  if (order.status === "pending") {
    if (order.paymentMethod === "cod")
      return { label: "Mark shipped", status: "shipped", icon: Truck };
    if (order.paymentMethod === "aba_manual") {
      return { label: "Payment checked — mark paid", status: "paid", icon: Banknote };
    }
    return null; // KHQR confirms itself
  }
  if (order.status === "paid") return { label: "Mark shipped", status: "shipped", icon: Truck };
  if (order.status === "shipped") {
    return {
      label: order.paymentMethod === "cod" ? "Delivered & cash collected" : "Mark delivered",
      status: "done",
      icon: CheckCircle2,
    };
  }
  return null;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function printSlip(order: Order) {
  const win = window.open("", "_blank", "width=420,height=640");
  if (!win) {
    toast.error("Allow pop-ups to print the packing slip");
    return;
  }
  const rows = order.items
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.title)}</td><td style="text-align:center">${item.quantity}</td><td style="text-align:right">${money(item.price * item.quantity, order.currency)}</td></tr>`,
    )
    .join("");
  const paid = order.status === "paid" || order.status === "shipped" || order.status === "done";
  win.document.write(`<!doctype html><html><head><title>${escapeHtml(orderNumber(order))}</title>
<style>body{font-family:system-ui,sans-serif;padding:16px;font-size:13px}h1{font-size:18px;margin:0}
table{width:100%;border-collapse:collapse;margin:12px 0}td,th{border-bottom:1px solid #ddd;padding:6px 2px;text-align:left}
.box{border:2px solid #000;padding:8px;margin-top:8px;font-size:15px;font-weight:600}.muted{color:#555}</style></head><body>
<h1>BillieGrace Closet</h1>
<p class="muted">Order <b>${escapeHtml(orderNumber(order))}</b> · ${new Date(order.createdAt).toLocaleString()}</p>
<p><b>${escapeHtml(order.customerName)}</b><br>${escapeHtml(order.phone)}<br>${escapeHtml(order.address).replace(/\n/g, "<br>")}</p>
<table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th></tr></thead><tbody>${rows}</tbody></table>
<p style="text-align:right;font-size:15px"><b>Total ${money(order.total, order.currency)}</b></p>
<div class="box">${paid ? "PAID — do not collect money" : `COLLECT ${money(order.total, order.currency)} IN CASH`}</div>
<script>window.onload=()=>{window.print()}</script></body></html>`);
  win.document.close();
}

function PaymentInfo({ order }: { order: Order }) {
  const approved = order.payments.find((p) => p.status === "approved");
  const issue = order.payments.find((p) => p.status === "declined");
  return (
    <div className="space-y-0.5 text-sm">
      <p className="font-medium">{money(order.total, order.currency)}</p>
      <p className="text-muted-foreground">{PAYMENT_METHOD_LABEL[order.paymentMethod]}</p>
      {approved ? (
        <p className="text-green-700">
          Paid {money(approved.amount, approved.currency)}
          {approved.bankName ? ` from ${approved.bankName}` : ""}
          {approved.payerAccount ? ` (${approved.payerAccount})` : ""}
          {approved.apv ? ` · APV ${approved.apv}` : ""}
          {approved.paidAt ? ` · ${new Date(approved.paidAt).toLocaleString()}` : ""}
        </p>
      ) : order.paidAt && order.status !== "pending" ? (
        <p className="text-green-700">Paid {new Date(order.paidAt).toLocaleString()}</p>
      ) : null}
      {issue ? (
        <p className="text-red-600">Wrong amount received: {money(issue.amount, issue.currency)}</p>
      ) : null}
      {order.paymentMethod === "khqr" && order.status === "pending" && order.paymentExpiresAt ? (
        <p className="text-muted-foreground">
          {order.paymentExpiresAt > Date.now()
            ? `QR open until ${new Date(order.paymentExpiresAt).toLocaleTimeString()}`
            : "QR expired — not paid"}
        </p>
      ) : null}
    </div>
  );
}

function OrdersAdmin() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("to_pack");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [posStates, setPosStates] = useState<Map<string, OrderPosState>>(new Map());
  const cleanedUp = useRef(false);

  const loadOrders = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    try {
      const next = await getAllOrders();
      setOrders(next);
      // POS state is a second opinion; a failure here must not hide the orders.
      getOrderPosStates(next)
        .then(setPosStates)
        .catch((error) => console.error("[admin/orders] POS state:", error));
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to load orders");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();

    // Tidy up once per visit: cancel KHQR orders nobody paid for.
    if (!cleanedUp.current) {
      cleanedUp.current = true;
      cancelUnpaidOrders()
        .then((result) => {
          if (result.cancelled || result.paid) void loadOrders(true);
        })
        .catch(() => {});
    }

    const channel = supabase
      ?.channel("admin-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        void loadOrders(true);
      })
      .subscribe();
    return () => {
      channel?.unsubscribe();
    };
  }, [loadOrders]);

  const counts = useMemo(() => {
    const result = Object.fromEntries(
      TABS.map((t) => [t.id, orders.filter(t.match).length]),
    ) as Record<TabId, number>;
    result.pos = orders.filter((o) => needsPosAttention(posStates.get(o.id))).length;
    return result;
  }, [orders, posStates]);

  const visible = useMemo(() => {
    const match =
      tab === "pos"
        ? (o: Order) => needsPosAttention(posStates.get(o.id))
        : TABS.find((t) => t.id === tab)!.match;
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    return orders.filter((o) => {
      if (!q) return match(o);
      return (
        orderNumber(o).toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        (digits.length >= 3 && o.phone.replace(/\D/g, "").includes(digits))
      );
    });
  }, [orders, tab, query, posStates]);

  const retrySync = async (order: Order) => {
    setBusyId(order.id);
    try {
      await retryOrderPosSync(order.id);
      toast.success(`${orderNumber(order)} synced with the POS`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "POS sync failed again");
    } finally {
      setBusyId(null);
      void loadOrders(true);
    }
  };

  const changeStatus = async (order: Order, status: OrderStatus) => {
    if (
      status === "cancelled" &&
      !window.confirm(`Cancel order ${orderNumber(order)}? Stock and money will be reversed.`)
    ) {
      return;
    }
    setBusyId(order.id);
    try {
      await updateOrderStatus(order.id, status);
      toast.success(`${orderNumber(order)} · ${ORDER_STATUS[status].label}`);
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status } : o)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
      void loadOrders(true);
    } finally {
      setBusyId(null);
    }
  };

  const checkPayment = async (order: Order) => {
    setBusyId(order.id);
    try {
      const result = await checkOrderPayment({ data: { orderId: order.id } });
      if (result.state === "paid") toast.success(`${orderNumber(order)} is paid`);
      else toast.info(result.state === "pending" ? "Not paid yet" : `Payment ${result.state}`);
      void loadOrders(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not check the payment");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminShell
      title="Orders (online)"
      description="Payments by KHQR confirm themselves. Pack, send and deliver from here or from Telegram."
      actions={
        <Button variant="outline" size="sm" onClick={() => void loadOrders()} disabled={isLoading}>
          <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
          Refresh
        </Button>
      }
    >
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                setQuery("");
              }}
              className={cn(
                "whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors",
                tab === t.id && !query
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
            >
              {t.label}
              <span
                className={cn(
                  "ml-1.5 text-xs",
                  tab === t.id && !query ? "opacity-80" : "text-muted-foreground",
                )}
              >
                {counts[t.id] ?? 0}
              </span>
            </button>
          ))}
          {counts.pos > 0 ? (
            <button
              onClick={() => {
                setTab("pos");
                setQuery("");
              }}
              className={cn(
                "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors",
                tab === "pos" && !query
                  ? "border-red-600 bg-red-600 text-white"
                  : "border-red-200 text-red-700 hover:bg-red-50",
              )}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              POS out of step
              <span className="ml-0.5 text-xs opacity-80">{counts.pos}</span>
            </button>
          ) : null}
        </div>
        <div className="relative md:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Order number, name or phone"
            className="pl-9"
          />
        </div>
      </div>

      {isLoading && orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading orders...</p>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">{query ? "No matching orders" : "Nothing here"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {query
                ? "Try another name, phone or order number."
                : "Orders in this step will appear here."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {visible.map((order) => {
            const status = statusFor(order);
            const action = nextAction(order);
            const busy = busyId === order.id;
            const pos = posStates.get(order.id);
            const posProblem = pos?.problem ? POS_PROBLEM_LABEL[pos.problem] : null;
            const unmatched = pos?.unmatchedItems ?? [];
            return (
              <Card key={order.id} className={cn(needsPosAttention(pos) && "border-red-300")}>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                  <div className="space-y-1">
                    <CardTitle className="font-mono text-base">{orderNumber(order)}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {new Date(order.createdAt).toLocaleString()}
                      {pos?.saleCode ? ` · POS ${pos.saleCode}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {posProblem ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800">
                        <AlertTriangle className="h-3 w-3" /> {posProblem.badge}
                      </span>
                    ) : null}
                    {unmatched.length > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800">
                        <AlertTriangle className="h-3 w-3" /> No stock row
                      </span>
                    ) : null}
                    <span
                      className={cn("rounded-full px-3 py-1 text-xs font-medium", status.color)}
                    >
                      {status.label}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {posProblem || unmatched.length > 0 ? (
                    <div className="flex flex-col gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        {posProblem ? <p>{posProblem.detail}</p> : null}
                        {unmatched.length > 0 ? (
                          <p>
                            Sold without a stock row, so stock did not move:{" "}
                            <span className="font-medium">{unmatched.join(", ")}</span>. Link the
                            product to a stock item and adjust the stock by hand.
                          </p>
                        ) : null}
                      </div>
                      {posProblem ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 border-red-300 bg-white text-red-800 hover:bg-red-100"
                          disabled={busy}
                          onClick={() => void retrySync(order)}
                        >
                          <RefreshCw className={cn("mr-2 h-4 w-4", busy && "animate-spin")} />
                          Retry POS sync
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="text-sm">
                      <p className="text-xs font-medium uppercase text-muted-foreground">
                        Customer
                      </p>
                      <p className="font-medium">{order.customerName}</p>
                      <a
                        href={`tel:${order.phone}`}
                        className="inline-flex items-center gap-1 text-primary"
                      >
                        <Phone className="h-3.5 w-3.5" /> {order.phone}
                      </a>
                      <p className="mt-1 text-muted-foreground">
                        <LinkifiedText text={order.address} />
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase text-muted-foreground">Payment</p>
                      <PaymentInfo order={order} />
                    </div>
                  </div>

                  <div className="border-t pt-3">
                    <div className="space-y-1.5">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-3 text-sm">
                          <span className="flex min-w-0 items-center gap-2">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt=""
                                className="h-8 w-8 shrink-0 rounded object-cover"
                              />
                            ) : null}
                            <span className="truncate">
                              {item.title} × {item.quantity}
                            </span>
                          </span>
                          <span className="shrink-0 text-muted-foreground">
                            {money(item.price * item.quantity, item.currency || order.currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                    {action ? (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => void changeStatus(order, action.status)}
                      >
                        <action.icon className="mr-2 h-4 w-4" /> {action.label}
                      </Button>
                    ) : null}
                    {order.paymentMethod === "khqr" && order.status === "pending" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void checkPayment(order)}
                      >
                        <RefreshCw className={cn("mr-2 h-4 w-4", busy && "animate-spin")} /> Check
                        payment now
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline" onClick={() => printSlip(order)}>
                      <Printer className="mr-2 h-4 w-4" /> Packing slip
                    </Button>
                    {order.status !== "cancelled" && order.status !== "done" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={busy}
                        onClick={() => void changeStatus(order, "cancelled")}
                      >
                        <XCircle className="mr-2 h-4 w-4" /> Cancel
                      </Button>
                    ) : null}
                    <div className="ml-auto">
                      <Select
                        value={order.status}
                        onValueChange={(value) => void changeStatus(order, value as OrderStatus)}
                        disabled={busy}
                      >
                        <SelectTrigger className="h-8 w-[170px] text-xs" aria-label="Set status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {ORDER_STATUS[s].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
