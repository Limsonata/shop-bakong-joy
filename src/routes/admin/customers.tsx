import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Phone,
  RefreshCw,
  Search,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { ReminderButtons } from "@/components/admin/ReminderButtons";
import { StatCard } from "@/components/admin/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPrice } from "@/lib/format";
import { buildCustomers, type Customer } from "@/lib/pos/customers";
import { downloadFile, listSales, toCsv } from "@/lib/pos/store";
import { balanceOwed, localDate, round2, type Sale } from "@/lib/pos/types";

export const Route = createFileRoute("/admin/customers")({
  head: () => ({ meta: [{ title: "Customers - Admin" }] }),
  component: CustomersPage,
});

type Filter = "all" | "owing" | "repeat" | "lapsed";

const LAPSED_DAYS = 60;

function daysSince(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return 0;
  return Math.floor((Date.now() - new Date(y, m - 1, d).getTime()) / 86_400_000);
}

function CustomersPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setSales(await listSales(3000));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load sales");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const customers = useMemo(() => buildCustomers(sales), [sales]);

  const totals = useMemo(() => {
    const owing = customers.filter((c) => c.owed > 0);
    return {
      count: customers.length,
      repeat: customers.filter((c) => c.orders >= 2).length,
      owingCount: owing.length,
      owed: round2(owing.reduce((sum, c) => sum + c.owed, 0)),
    };
  }, [customers]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const digits = term.replace(/\D/g, "");
    return customers
      .filter((c) => {
        if (filter === "owing" && c.owed <= 0) return false;
        if (filter === "repeat" && c.orders < 2) return false;
        if (filter === "lapsed" && (c.orders === 0 || daysSince(c.lastPurchase) < LAPSED_DAYS))
          return false;
        if (!term) return true;
        return (
          c.name.toLowerCase().includes(term) ||
          c.city.toLowerCase().includes(term) ||
          (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits))
        );
      })
      .sort((a, b) => (filter === "owing" ? b.owed - a.owed : 0));
  }, [customers, search, filter]);

  const exportCsv = () =>
    downloadFile(
      `customers-${localDate()}.csv`,
      toCsv(
        visible.map((c) => ({
          Name: c.name,
          Phone: c.phone,
          City: c.city,
          Orders: c.orders,
          Spent: c.spent,
          Owed: c.owed,
          Profit: c.profit,
          "First purchase": c.firstPurchase,
          "Last purchase": c.lastPurchase,
        })),
      ),
      "text/csv",
    );

  return (
    <AdminShell
      title="Customers"
      description="Everyone who bought from you, what they bought and what they still owe."
      actions={
        <>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={visible.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Customers"
          value={String(totals.count)}
          hint="With a name or phone"
          icon={Users}
        />
        <StatCard
          label="Came back"
          value={String(totals.repeat)}
          hint={
            totals.count
              ? `${Math.round((totals.repeat / totals.count) * 100)}% bought twice or more`
              : undefined
          }
          tone="good"
        />
        <StatCard
          label="Owe you money"
          value={formatPrice(totals.owed)}
          hint={`${totals.owingCount} customer${totals.owingCount === 1 ? "" : "s"}`}
          icon={Wallet}
          tone={totals.owed > 0 ? "warn" : "default"}
        />
      </div>

      <Card className="mt-6">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Name, phone or city"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Select value={filter} onValueChange={(value) => setFilter(value as Filter)}>
              <SelectTrigger className="w-[210px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All customers</SelectItem>
                <SelectItem value="owing">Owe money</SelectItem>
                <SelectItem value="repeat">Bought 2+ times</SelectItem>
                <SelectItem value="lapsed">No purchase in {LAPSED_DAYS}+ days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading customers…</p>
          ) : visible.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No customers match.</p>
          ) : (
            <ul className="divide-y">
              {visible.map((customer) => (
                <CustomerRow
                  key={customer.key}
                  customer={customer}
                  open={open === customer.key}
                  onToggle={() => setOpen(open === customer.key ? null : customer.key)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}

function CustomerRow({
  customer,
  open,
  onToggle,
}: {
  customer: Customer;
  open: boolean;
  onToggle: () => void;
}) {
  const owingSales = customer.sales.filter((s) => s.status === "confirmed" && balanceOwed(s) > 0);
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
          aria-expanded={open}
        >
          {open ? (
            <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{customer.name}</span>
              {customer.orders >= 2 ? (
                <Badge variant="outline" className="border-emerald-200 text-emerald-700">
                  {customer.orders} orders
                </Badge>
              ) : null}
              {customer.channels.map((channel) => (
                <Badge key={channel} variant="outline" className="text-muted-foreground">
                  {channel}
                </Badge>
              ))}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {[customer.phone || "no phone", customer.city, `last ${customer.lastPurchase}`]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </button>
        <div className="flex flex-col items-end gap-1">
          <p className="font-semibold tabular-nums">{formatPrice(customer.spent)}</p>
          {customer.owed > 0 ? (
            <>
              <p className="text-xs text-amber-700">owes {formatPrice(customer.owed)}</p>
              <ReminderButtons
                compact
                target={{
                  name: customer.name,
                  phone: customer.phone,
                  owed: customer.owed,
                  codes: owingSales.map((s) => s.code),
                }}
              />
            </>
          ) : (
            <p className="text-xs text-muted-foreground">all paid</p>
          )}
        </div>
      </div>

      {open ? (
        <div className="mt-3 space-y-2 rounded-md bg-muted/40 p-3 text-sm">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span>First purchase {customer.firstPurchase}</span>
            <span>Profit earned {formatPrice(customer.profit)}</span>
            {customer.phone ? (
              <a
                href={`tel:${customer.phone}`}
                className="inline-flex items-center gap-1 text-primary"
              >
                <Phone className="h-3 w-3" /> Call
              </a>
            ) : null}
          </div>
          <ul className="divide-y rounded-md border bg-background">
            {customer.sales.map((sale) => (
              <li
                key={sale.id}
                className="flex flex-wrap items-start justify-between gap-2 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono">{sale.code}</span> · {sale.soldAt} · {sale.channel}
                    {sale.status === "cancelled" ? " · cancelled" : ""}
                  </p>
                  <p className="truncate">
                    {sale.items
                      .filter((item) => item.qty > 0)
                      .map(
                        (item) => `${item.qty} × ${item.name}${item.size ? ` (${item.size})` : ""}`,
                      )
                      .join(", ") || "Everything returned"}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`tabular-nums ${sale.status === "cancelled" ? "text-muted-foreground line-through" : ""}`}
                  >
                    {formatPrice(sale.total)}
                  </p>
                  {sale.status === "confirmed" && balanceOwed(sale) > 0 ? (
                    <p className="text-xs text-amber-700">owes {formatPrice(balanceOwed(sale))}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}
