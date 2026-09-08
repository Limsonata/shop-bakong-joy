import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, RotateCcw, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { StatCard } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPrice } from "@/lib/format";
import { getAllOrders, type Order } from "@/lib/orderStore";
import { isCollected } from "@/lib/orderStatus";
import {
  downloadFile,
  exportBackup,
  loadShopData,
  resetLocalData,
  restoreLocalBackup,
  toCsv,
  usingLocalOnly,
  type ShopData,
} from "@/lib/pos/store";
import { isRunningCost, round2, saleProfit, stockLeft } from "@/lib/pos/types";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({ meta: [{ title: "Reports - Admin" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const [data, setData] = useState<ShopData | null>(null);
  const [webOrders, setWebOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [shop, orders] = await Promise.all([
        loadShopData(),
        getAllOrders().catch((error) => {
          console.error("[reports] Failed to load online orders:", error);
          return [] as Order[];
        }),
      ]);
      setData(shop);
      setWebOrders(orders);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load the data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const monthly = useMemo(() => {
    if (!data) return [];
    const map = new Map<
      string,
      { month: string; revenue: number; cost: number; expenses: number }
    >();
    const bucket = (month: string) => {
      const existing = map.get(month) ?? { month, revenue: 0, cost: 0, expenses: 0 };
      map.set(month, existing);
      return existing;
    };

    data.sales
      .filter((sale) => sale.status === "confirmed")
      .forEach((sale) => {
        const row = bucket(sale.soldAt.slice(0, 7));
        row.revenue = round2(row.revenue + sale.subtotal - sale.discount);
        row.cost = round2(
          row.cost + sale.items.reduce((sum, item) => sum + item.qty * item.unitCost, 0),
        );
      });

    // Online orders count towards monthly revenue too (collected only;
    // unit cost is unknown for them, so profit is revenue-driven here).
    webOrders
      .filter((order) => isCollected(order.status))
      .forEach((order) => {
        const row = bucket(new Date(order.createdAt).toISOString().slice(0, 7));
        row.revenue = round2(row.revenue + order.total);
      });

    data.financeEntries
      .filter((entry) => entry.kind === "expense" && isRunningCost(entry.category))
      .forEach((entry) => {
        const row = bucket(entry.entryDate.slice(0, 7));
        row.expenses = round2(row.expenses + entry.amount);
      });

    return Array.from(map.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((row) => ({ ...row, profit: round2(row.revenue - row.cost - row.expenses) }));
  }, [data, webOrders]);

  const webRevenue = useMemo(
    () => round2(webOrders.filter((order) => isCollected(order.status)).reduce((sum, order) => sum + order.total, 0)),
    [webOrders],
  );

  const bestSellers = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { name: string; qty: number; revenue: number; profit: number }>();
    data.sales
      .filter((sale) => sale.status === "confirmed")
      .forEach((sale) => {
        sale.items.forEach((item) => {
          const key = item.name.toLowerCase();
          const row = map.get(key) ?? { name: item.name, qty: 0, revenue: 0, profit: 0 };
          row.qty += item.qty;
          row.revenue = round2(row.revenue + item.qty * item.unitPrice);
          row.profit = round2(row.profit + item.qty * (item.unitPrice - item.unitCost));
          map.set(key, row);
        });
      });
    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [data]);

  const deadStock = useMemo(() => {
    if (!data) return [];
    return data.stockItems
      .filter((item) => !item.archived && item.sold === 0 && stockLeft(item) > 0)
      .sort((a, b) => stockLeft(b) * b.cost - stockLeft(a) * a.cost)
      .slice(0, 10);
  }, [data]);

  const backup = async () => {
    try {
      downloadFile(
        `nichnich-backup-${new Date().toISOString().slice(0, 10)}.json`,
        await exportBackup(),
        "application/json",
      );
      toast.success("Backup downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the backup");
    }
  };

  const restore = async (file: File) => {
    if (
      !window.confirm(
        "Restoring replaces all stock, sales and money records in this browser. Continue?",
      )
    ) {
      return;
    }
    try {
      restoreLocalBackup(await file.text());
      toast.success("Backup restored");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That file could not be read");
    }
  };

  const reset = async () => {
    if (
      !window.confirm(
        "Reset back to the data imported from the spreadsheet? Everything recorded since then is lost.",
      )
    ) {
      return;
    }
    resetLocalData();
    toast.success("Reset to the imported spreadsheet data");
    await load();
  };

  const summary = data?.summary;

  return (
    <AdminShell
      title="Reports"
      description="Profit, best sellers, and backups."
      actions={
        <Button variant="outline" size="sm" onClick={backup}>
          <Save className="mr-2 h-4 w-4" />
          Backup
        </Button>
      }
    >
      {loading || !summary ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading reports…</p>
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Profit
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Revenue"
                value={formatPrice(summary.revenue + webRevenue)}
                hint={
                  webRevenue > 0
                    ? `includes ${formatPrice(webRevenue)} online orders`
                    : "Goods sold, no delivery"
                }
              />
              <StatCard
                label="Cost of goods"
                value={formatPrice(summary.cogs)}
                hint="What those goods cost you"
              />
              <StatCard
                label="Gross profit"
                value={formatPrice(summary.grossProfit)}
                hint={
                  summary.revenue > 0
                    ? `${((summary.grossProfit / summary.revenue) * 100).toFixed(0)}% margin`
                    : undefined
                }
                tone="good"
              />
              <StatCard
                label="Net profit"
                value={formatPrice(summary.netProfit)}
                hint={`after ${formatPrice(summary.runningCosts)} running costs`}
                tone={summary.netProfit >= 0 ? "good" : "bad"}
              />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Cash
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Money in" value={formatPrice(summary.cashIn)} tone="good" />
              <StatCard
                label="Money out"
                value={formatPrice(summary.cashOut)}
                hint={`${formatPrice(summary.inventorySpend)} on stock`}
                tone="bad"
              />
              <StatCard
                label="Cash on hand"
                value={formatPrice(summary.cashOnHand)}
                tone={summary.cashOnHand >= 0 ? "good" : "bad"}
              />
              <StatCard
                label="Owed by customers"
                value={formatPrice(summary.outstanding)}
                tone={summary.outstanding > 0 ? "warn" : "default"}
              />
            </div>
          </section>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Month by month</CardTitle>
              <CardDescription>
                Revenue against cost of goods and running costs. The gap is your profit.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {monthly.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No sales yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} tickFormatter={(value: number) => `$${value}`} />
                    <Tooltip formatter={(value: number) => formatPrice(value)} />
                    <Legend />
                    <Bar dataKey="revenue" name="Revenue" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="cost" name="Cost of goods" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="profit" name="Profit" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Best sellers</CardTitle>
                <CardDescription>By revenue earned</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Sold</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bestSellers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                          No sales yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      bestSellers.map((row) => (
                        <TableRow key={row.name}>
                          <TableCell className="text-sm">{row.name}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.qty}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatPrice(row.revenue)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-emerald-600">
                            {formatPrice(row.profit)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Not selling yet</CardTitle>
                <CardDescription>
                  Stock with zero sales — {formatPrice(summary.stockValue)} is tied up in stock
                  overall
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Left</TableHead>
                      <TableHead className="text-right">Tied up</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deadStock.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                          Everything has sold at least once.
                        </TableCell>
                      </TableRow>
                    ) : (
                      deadStock.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-sm">
                            {item.name}
                            <span className="block text-xs text-muted-foreground">
                              {[item.sku, item.size, item.color].filter(Boolean).join(" · ")}
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {stockLeft(item)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatPrice(stockLeft(item) * item.cost)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Backup &amp; export</CardTitle>
              <CardDescription>
                {usingLocalOnly
                  ? "Data lives in this browser only — download a backup at the end of each week."
                  : "Data is stored in Supabase. Exports are still handy for accounting."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={backup}>
                <Save className="mr-2 h-4 w-4" />
                Download backup (JSON)
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  downloadFile(
                    `profit-by-month-${new Date().toISOString().slice(0, 10)}.csv`,
                    toCsv(
                      monthly.map((row) => ({
                        Month: row.month,
                        Revenue: row.revenue,
                        "Cost of goods": row.cost,
                        "Running costs": row.expenses,
                        Profit: row.profit,
                      })),
                    ),
                    "text/csv",
                  )
                }
              >
                <Download className="mr-2 h-4 w-4" />
                Profit by month (CSV)
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  downloadFile(
                    `sale-profit-${new Date().toISOString().slice(0, 10)}.csv`,
                    toCsv(
                      (data?.sales ?? []).map((sale) => ({
                        Code: sale.code,
                        Date: sale.soldAt,
                        Customer: sale.customerName,
                        Total: sale.total,
                        Paid: sale.paid,
                        Profit: saleProfit(sale),
                        Status: sale.status,
                      })),
                    ),
                    "text/csv",
                  )
                }
              >
                <Download className="mr-2 h-4 w-4" />
                Profit per sale (CSV)
              </Button>

              {usingLocalOnly ? (
                <>
                  <Button variant="outline" onClick={() => fileInput.current?.click()}>
                    <Upload className="mr-2 h-4 w-4" />
                    Restore backup
                  </Button>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void restore(file);
                      event.target.value = "";
                    }}
                  />
                  <Button
                    variant="ghost"
                    className="text-red-600 hover:text-red-700"
                    onClick={reset}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset to imported data
                  </Button>
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}
    </AdminShell>
  );
}
