import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownCircle,
  Boxes,
  DollarSign,
  PackagePlus,
  Receipt,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { StatCard } from "@/components/admin/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice } from "@/lib/format";
import { getAllOrders, type Order } from "@/lib/orderStore";
import { loadShopData, type ShopData } from "@/lib/pos/store";
import { balanceOwed, isLowStock, round2, stockLeft } from "@/lib/pos/types";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin Dashboard" }] }),
  component: AdminDashboard,
});

const DAY_MS = 24 * 60 * 60 * 1000;

function AdminDashboard() {
  const [data, setData] = useState<ShopData | null>(null);
  const [webOrders, setWebOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [shop, orders] = await Promise.all([
        loadShopData(),
        getAllOrders().catch(() => [] as Order[]),
      ]);
      setData(shop);
      setWebOrders(orders);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load the dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  const todayTotals = useMemo(() => {
    if (!data) return { sales: 0, revenue: 0, collected: 0 };
    const rows = data.sales.filter((sale) => sale.soldAt === today && sale.status === "confirmed");
    return {
      sales: rows.length,
      revenue: round2(rows.reduce((sum, sale) => sum + sale.total, 0)),
      collected: round2(rows.reduce((sum, sale) => sum + sale.paid, 0)),
    };
  }, [data, today]);

  const trend = useMemo(() => {
    if (!data) return [];
    const days: Array<{ date: string; label: string; revenue: number; collected: number }> = [];
    for (let offset = 13; offset >= 0; offset -= 1) {
      const date = new Date(Date.now() - offset * DAY_MS).toISOString().slice(0, 10);
      days.push({ date, label: date.slice(5), revenue: 0, collected: 0 });
    }
    const index = new Map(days.map((day) => [day.date, day]));
    data.sales
      .filter((sale) => sale.status === "confirmed")
      .forEach((sale) => {
        const day = index.get(sale.soldAt);
        if (!day) return;
        day.revenue = round2(day.revenue + sale.total);
        day.collected = round2(day.collected + sale.paid);
      });
    return days;
  }, [data]);

  const lowStock = useMemo(
    () =>
      (data?.stockItems ?? [])
        .filter(isLowStock)
        .sort((a, b) => stockLeft(a) - stockLeft(b))
        .slice(0, 8),
    [data],
  );

  const unpaid = useMemo(
    () =>
      (data?.sales ?? [])
        .filter((sale) => sale.status === "confirmed" && balanceOwed(sale) > 0)
        .sort((a, b) => balanceOwed(b) - balanceOwed(a))
        .slice(0, 8),
    [data],
  );

  const toPrepare = useMemo(
    () =>
      (data?.sales ?? []).filter(
        (sale) => sale.status === "confirmed" && sale.deliveryStatus === "preparing",
      ),
    [data],
  );

  const recentSales = useMemo(() => (data?.sales ?? []).slice(0, 6), [data]);
  const pendingWebOrders = webOrders.filter((order) => order.status === "pending").length;
  const summary = data?.summary;

  return (
    <AdminShell
      title="Dashboard"
      description="Where the shop stands right now."
      actions={
        <>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" asChild>
            <Link to="/admin/pos">
              <ShoppingCart className="mr-2 h-4 w-4" />
              New sale
            </Link>
          </Button>
        </>
      }
    >
      {loading || !summary ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Today"
              value={formatPrice(todayTotals.revenue)}
              hint={`${todayTotals.sales} sale${todayTotals.sales === 1 ? "" : "s"} · ${formatPrice(todayTotals.collected)} collected`}
              icon={Receipt}
            />
            <StatCard
              label="Cash on hand"
              value={formatPrice(summary.cashOnHand)}
              hint={`${formatPrice(summary.cashIn)} in · ${formatPrice(summary.cashOut)} out`}
              icon={Wallet}
              tone={summary.cashOnHand >= 0 ? "good" : "bad"}
            />
            <StatCard
              label="Owed by customers"
              value={formatPrice(summary.outstanding)}
              hint={`${unpaid.length} booking${unpaid.length === 1 ? "" : "s"} with a balance`}
              icon={AlertTriangle}
              tone={summary.outstanding > 0 ? "warn" : "default"}
            />
            <StatCard
              label="Net profit"
              value={formatPrice(summary.netProfit)}
              hint={`${formatPrice(summary.revenue)} revenue − ${formatPrice(summary.cogs)} cost − ${formatPrice(summary.runningCosts)} costs`}
              icon={TrendingUp}
              tone={summary.netProfit >= 0 ? "good" : "bad"}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Stock value"
              value={formatPrice(summary.stockValue)}
              hint={`${summary.unitsLeft} units · ${formatPrice(summary.potentialSales)} if all sells`}
              icon={Boxes}
            />
            <StatCard
              label="Low stock"
              value={String(summary.lowStockCount)}
              hint="Need reordering"
              icon={AlertTriangle}
              tone={summary.lowStockCount > 0 ? "warn" : "default"}
            />
            <StatCard
              label="To prepare / send"
              value={String(toPrepare.length)}
              hint="Deliveries not sent yet"
              icon={PackagePlus}
              tone={toPrepare.length > 0 ? "warn" : "default"}
            />
            <StatCard
              label="Website orders"
              value={String(webOrders.length)}
              hint={`${pendingWebOrders} pending online`}
              icon={DollarSign}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Last 14 days</CardTitle>
              <CardDescription>Billed against cash actually collected</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="billed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(value: number) => `$${value}`} />
                  <Tooltip formatter={(value: number) => formatPrice(value)} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Billed"
                    stroke="#0ea5e9"
                    fill="url(#billed)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="collected"
                    name="Collected"
                    stroke="#10b981"
                    fill="transparent"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Reorder soon</CardTitle>
                <CardDescription>At or below the alert level</CardDescription>
              </CardHeader>
              <CardContent>
                {lowStock.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Stock levels look fine.</p>
                ) : (
                  <ul className="space-y-2">
                    {lowStock.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0">
                          <span className="block truncate">{item.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {[item.sku, item.size, item.color].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            stockLeft(item) <= 0
                              ? "border-red-200 text-red-700"
                              : "border-amber-200 text-amber-700"
                          }
                        >
                          {stockLeft(item)} left
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
                <Button variant="outline" size="sm" className="mt-4 w-full" asChild>
                  <Link to="/admin/inventory">Open stock</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Waiting for payment</CardTitle>
                <CardDescription>Deposits with a balance left</CardDescription>
              </CardHeader>
              <CardContent>
                {unpaid.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Everyone has paid in full.</p>
                ) : (
                  <ul className="space-y-2">
                    {unpaid.map((sale) => (
                      <li key={sale.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0">
                          <span className="block truncate">{sale.customerName}</span>
                          <span className="text-xs text-muted-foreground">
                            {sale.code} · {sale.soldAt}
                          </span>
                        </span>
                        <span className="whitespace-nowrap font-medium tabular-nums text-amber-700">
                          {formatPrice(balanceOwed(sale))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <Button variant="outline" size="sm" className="mt-4 w-full" asChild>
                  <Link to="/admin/sales">Open sales</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Latest sales</CardTitle>
                <CardDescription>Most recent first</CardDescription>
              </CardHeader>
              <CardContent>
                {recentSales.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sales recorded yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {recentSales.map((sale) => (
                      <li key={sale.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0">
                          <span className="block truncate">{sale.customerName}</span>
                          <span className="text-xs text-muted-foreground">
                            {sale.soldAt} · {sale.items.length} item
                            {sale.items.length > 1 ? "s" : ""}
                          </span>
                        </span>
                        <span className="whitespace-nowrap font-medium tabular-nums">
                          {formatPrice(sale.total)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 grid gap-2">
                  <Button size="sm" asChild>
                    <Link to="/admin/pos">
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      Record a sale
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/admin/finance">
                      <ArrowDownCircle className="mr-2 h-4 w-4" />
                      Record an expense
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
