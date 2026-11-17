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
import { Download, History, RotateCcw, Save, Send, Upload } from "lucide-react";
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
import { sendDailySummaryNow } from "@/lib/api/telegram.functions";
import { getSupabaseAccessToken } from "@/lib/authToken";
import {
  downloadFile,
  exportBackup,
  listAuditLog,
  loadShopData,
  resetLocalData,
  restoreLocalBackup,
  toCsv,
  usingLocalOnly,
  type AuditEntry,
  type ShopData,
} from "@/lib/pos/store";
import { isRunningCost, localDate, round2, saleProfit, stockLeft } from "@/lib/pos/types";

const DEAD_STOCK_DAYS = 60;
const EXPENSE_MONTHS = 6;

const CHANNEL_LABEL: Record<string, string> = {
  "walk-in": "In store",
  booking: "Booking / deposit",
  online: "Online (website)",
};

const TABLE_LABEL: Record<string, string> = {
  products: "Product",
  stock_items: "Stock",
  orders: "Order",
  sales: "Sale",
};

/** "price 12 → 15, stock_in 10 → 12" */
function describeChange(entry: AuditEntry): string {
  const keys = new Set([...Object.keys(entry.oldData ?? {}), ...Object.keys(entry.newData ?? {})]);
  const show = (value: unknown) =>
    value === null || value === undefined
      ? "–"
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  if (entry.action === "insert") return "created";
  if (entry.action === "delete") return "deleted";
  return [...keys]
    .map(
      (key) =>
        `${key.replace(/_/g, " ")} ${show(entry.oldData?.[key])} → ${show(entry.newData?.[key])}`,
    )
    .join(", ");
}

export const Route = createFileRoute("/admin/reports")({
  head: () => ({ meta: [{ title: "Reports - Admin" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const [data, setData] = useState<ShopData | null>(null);
  const [webOrders, setWebOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [sendingSummary, setSendingSummary] = useState(false);
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
      listAuditLog(100)
        .then((entries) => {
          setAudit(entries);
          setAuditError(null);
        })
        .catch((error) =>
          setAuditError(
            error instanceof Error ? error.message : "Could not load the change history",
          ),
        );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load the data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const unsyncedWebOrders = useMemo(() => {
    const synced = new Set((data?.sales ?? []).map((sale) => sale.orderId).filter(Boolean));
    return webOrders.filter((order) => isCollected(order.status) && !synced.has(order.id));
  }, [data, webOrders]);

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

    // Online orders that never reached the POS still count (collected only;
    // their cost is unknown). Synced ones are already in the sales above.
    unsyncedWebOrders.forEach((order) => {
      const row = bucket(localDate(new Date(order.createdAt)).slice(0, 7));
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
  }, [data, unsyncedWebOrders]);

  const webRevenue = useMemo(
    () => round2(unsyncedWebOrders.reduce((sum, order) => sum + order.total, 0)),
    [unsyncedWebOrders],
  );

  const byChannel = useMemo(() => {
    if (!data) return [];
    const map = new Map<
      string,
      { channel: string; sales: number; revenue: number; cost: number }
    >();
    data.sales
      .filter((sale) => sale.status === "confirmed")
      .forEach((sale) => {
        const row = map.get(sale.channel) ?? {
          channel: sale.channel,
          sales: 0,
          revenue: 0,
          cost: 0,
        };
        row.sales += 1;
        row.revenue = round2(row.revenue + sale.subtotal - sale.discount);
        row.cost = round2(
          row.cost + sale.items.reduce((sum, item) => sum + item.qty * item.unitCost, 0),
        );
        map.set(sale.channel, row);
      });
    return Array.from(map.values())
      .map((row) => ({ ...row, profit: round2(row.revenue - row.cost) }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [data]);

  const expenseMonths = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    for (let back = EXPENSE_MONTHS - 1; back >= 0; back -= 1) {
      months.push(localDate(new Date(now.getFullYear(), now.getMonth() - back, 1)).slice(0, 7));
    }
    const table = new Map<string, Record<string, number>>();
    (data?.financeEntries ?? [])
      .filter((entry) => entry.kind === "expense" && months.includes(entry.entryDate.slice(0, 7)))
      .forEach((entry) => {
        const row = table.get(entry.category) ?? {};
        const month = entry.entryDate.slice(0, 7);
        row[month] = round2((row[month] ?? 0) + entry.amount);
        table.set(entry.category, row);
      });
    const rows = Array.from(table.entries())
      .map(([category, values]) => ({
        category,
        values,
        total: round2(months.reduce((sum, month) => sum + (values[month] ?? 0), 0)),
      }))
      .sort((a, b) => b.total - a.total);
    const totals = Object.fromEntries(
      months.map((month) => [
        month,
        round2(rows.reduce((sum, row) => sum + (row.values[month] ?? 0), 0)),
      ]),
    ) as Record<string, number>;
    return { months, rows, totals };
  }, [data]);

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
    const lastSold = new Map<string, string>();
    data.sales
      .filter((sale) => sale.status === "confirmed")
      .forEach((sale) =>
        sale.items.forEach((item) => {
          if (!item.stockItemId) return;
          const previous = lastSold.get(item.stockItemId);
          if (!previous || sale.soldAt > previous) lastSold.set(item.stockItemId, sale.soldAt);
        }),
      );
    const cutoff = localDate(new Date(Date.now() - DEAD_STOCK_DAYS * 86_400_000));
    return data.stockItems
      .filter((item) => !item.archived && stockLeft(item) > 0)
      .map((item) => ({
        item,
        lastSold: lastSold.get(item.id) ?? null,
        // Never sold: count from the last time the row changed (usually the last restock).
        since: lastSold.get(item.id) ?? item.updatedAt.slice(0, 10),
      }))
      .filter((row) => row.since < cutoff)
      .sort((a, b) => stockLeft(b.item) * b.item.cost - stockLeft(a.item) * a.item.cost);
  }, [data]);

  const sendSummary = async (withBackup: boolean) => {
    setSendingSummary(true);
    try {
      const accessToken = await getSupabaseAccessToken();
      const result = await sendDailySummaryNow({ data: { accessToken, backup: withBackup } });
      if (result.ok)
        toast.success(
          withBackup ? "Summary and backup sent to Telegram" : "Summary sent to Telegram",
        );
      else toast.error(result.reason ?? "Could not send");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send");
    } finally {
      setSendingSummary(false);
    }
  };

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
        <>
          {!usingLocalOnly ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void sendSummary(false)}
              disabled={sendingSummary}
            >
              <Send className="mr-2 h-4 w-4" />
              {sendingSummary ? "Sending…" : "Send today's summary"}
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={backup}>
            <Save className="mr-2 h-4 w-4" />
            Backup
          </Button>
        </>
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Revenue"
                value={formatPrice(summary.revenue + webRevenue)}
                hint={
                  webRevenue > 0
                    ? `includes ${formatPrice(webRevenue)} online orders not in the POS`
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Profit by channel</CardTitle>
                <CardDescription>
                  Gross profit (price minus cost of goods) for each way you sell
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Channel</TableHead>
                      <TableHead className="text-right">Sales</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byChannel.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                          No sales yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      byChannel.map((row) => (
                        <TableRow key={row.channel}>
                          <TableCell className="text-sm">
                            {CHANNEL_LABEL[row.channel] ?? row.channel}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{row.sales}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatPrice(row.revenue)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-emerald-600">
                            {formatPrice(row.profit)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.revenue > 0
                              ? `${Math.round((row.profit / row.revenue) * 100)}%`
                              : "–"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <p className="mt-2 text-xs text-muted-foreground">
                  Online items with no stock row have no cost, so their profit shows too high.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Expenses by category</CardTitle>
                <CardDescription>Last {EXPENSE_MONTHS} months, from the cash book</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      {expenseMonths.months.map((month) => (
                        <TableHead key={month} className="text-right">
                          {month.slice(2).replace("-", "/")}
                        </TableHead>
                      ))}
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenseMonths.rows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={expenseMonths.months.length + 2}
                          className="py-8 text-center text-muted-foreground"
                        >
                          No expenses in this period.
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {expenseMonths.rows.map((row) => (
                          <TableRow key={row.category}>
                            <TableCell className="text-sm">
                              {row.category}
                              {!isRunningCost(row.category) ? (
                                <span className="block text-xs text-muted-foreground">
                                  not a running cost
                                </span>
                              ) : null}
                            </TableCell>
                            {expenseMonths.months.map((month) => (
                              <TableCell key={month} className="text-right tabular-nums">
                                {row.values[month] ? formatPrice(row.values[month]) : "–"}
                              </TableCell>
                            ))}
                            <TableCell className="text-right font-medium tabular-nums">
                              {formatPrice(row.total)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow>
                          <TableCell className="font-medium">All</TableCell>
                          {expenseMonths.months.map((month) => (
                            <TableCell key={month} className="text-right font-medium tabular-nums">
                              {formatPrice(expenseMonths.totals[month] ?? 0)}
                            </TableCell>
                          ))}
                          <TableCell className="text-right font-semibold tabular-nums">
                            {formatPrice(
                              expenseMonths.rows.reduce((sum, row) => sum + row.total, 0),
                            )}
                          </TableCell>
                        </TableRow>
                      </>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
                <CardTitle className="text-base">Dead stock</CardTitle>
                <CardDescription>
                  Not sold in {DEAD_STOCK_DAYS}+ days:{" "}
                  {formatPrice(
                    deadStock.reduce((sum, row) => sum + stockLeft(row.item) * row.item.cost, 0),
                  )}{" "}
                  of the {formatPrice(summary.stockValue)} in stock
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Last sold</TableHead>
                      <TableHead className="text-right">Left</TableHead>
                      <TableHead className="text-right">Tied up</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deadStock.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                          Everything sold in the last {DEAD_STOCK_DAYS} days.
                        </TableCell>
                      </TableRow>
                    ) : (
                      deadStock.slice(0, 15).map(({ item, lastSold }) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-sm">
                            {item.name}
                            <span className="block text-xs text-muted-foreground">
                              {[item.sku, item.size, item.color].filter(Boolean).join(" · ")}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {lastSold ?? "never"}
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

          {!usingLocalOnly ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="h-4 w-4" /> Change history
                </CardTitle>
                <CardDescription>
                  Who changed prices, stock levels, order status and sales. Newest first.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {auditError ? (
                  <p className="text-sm text-muted-foreground">
                    {/actor|label|column/i.test(auditError)
                      ? "Run the latest database migration (supabase db push) to start the change history."
                      : auditError}
                  </p>
                ) : audit.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
                ) : (
                  <ul className="max-h-[420px] divide-y overflow-y-auto text-sm">
                    {audit.map((entry) => (
                      <li
                        key={entry.id}
                        className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-2"
                      >
                        <span className="min-w-0">
                          <span className="font-medium">
                            {TABLE_LABEL[entry.table] ?? entry.table} {entry.label}
                          </span>
                          <span className="block break-words text-xs text-muted-foreground">
                            {describeChange(entry)}
                          </span>
                        </span>
                        <span className="whitespace-nowrap text-xs text-muted-foreground">
                          {entry.actor} · {new Date(entry.createdAt).toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Backup &amp; export</CardTitle>
              <CardDescription>
                {usingLocalOnly
                  ? "Data lives in this browser only — download a backup at the end of each week."
                  : "Data is stored in Supabase. A backup file is also sent to Telegram every evening with the daily summary."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={backup}>
                <Save className="mr-2 h-4 w-4" />
                Download backup (JSON)
              </Button>
              {!usingLocalOnly ? (
                <Button
                  variant="outline"
                  onClick={() => void sendSummary(true)}
                  disabled={sendingSummary}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Send summary + backup to Telegram
                </Button>
              ) : null}
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
