import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Download,
  Plus,
  RefreshCw,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { StatCard } from "@/components/admin/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPrice } from "@/lib/format";
import {
  addFinanceEntry,
  deleteFinanceEntry,
  downloadFile,
  listFinanceEntries,
  toCsv,
} from "@/lib/pos/store";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
  round2,
  type FinanceEntry,
  type FinanceKind,
} from "@/lib/pos/types";

export const Route = createFileRoute("/admin/finance")({
  head: () => ({ meta: [{ title: "Money - Admin" }] }),
  component: FinancePage,
});

const today = () => new Date().toISOString().slice(0, 10);

function monthKey(date: string): string {
  return date.slice(0, 7);
}

function FinancePage() {
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthFilter, setMonthFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState<"all" | FinanceKind>("all");

  const [formOpen, setFormOpen] = useState(false);
  const [kind, setKind] = useState<FinanceKind>("expense");
  const [entryDate, setEntryDate] = useState(today());
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("Inventory");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("cash");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setEntries(await listFinanceEntries());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load the cash book");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const months = useMemo(
    () =>
      Array.from(new Set(entries.map((entry) => monthKey(entry.entryDate))))
        .sort()
        .reverse(),
    [entries],
  );

  const visible = useMemo(
    () =>
      entries.filter((entry) => {
        if (monthFilter !== "all" && monthKey(entry.entryDate) !== monthFilter) return false;
        if (kindFilter !== "all" && entry.kind !== kindFilter) return false;
        return true;
      }),
    [entries, monthFilter, kindFilter],
  );

  const totals = useMemo(() => {
    const scope =
      monthFilter === "all"
        ? entries
        : entries.filter((e) => monthKey(e.entryDate) === monthFilter);
    const income = round2(
      scope.filter((e) => e.kind === "income").reduce((sum, e) => sum + e.amount, 0),
    );
    const expense = round2(
      scope.filter((e) => e.kind === "expense").reduce((sum, e) => sum + e.amount, 0),
    );
    const inventory = round2(
      scope
        .filter((e) => e.kind === "expense" && e.category === "Inventory")
        .reduce((sum, e) => sum + e.amount, 0),
    );
    return { income, expense, inventory, net: round2(income - expense) };
  }, [entries, monthFilter]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    visible
      .filter((entry) => entry.kind === "expense")
      .forEach((entry) =>
        map.set(entry.category, round2((map.get(entry.category) ?? 0) + entry.amount)),
      );
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [visible]);

  const openForm = (nextKind: FinanceKind) => {
    setKind(nextKind);
    setCategory(nextKind === "expense" ? "Inventory" : "Other");
    setEntryDate(today());
    setDescription("");
    setAmount("");
    setMethod("cash");
    setFormOpen(true);
  };

  const submit = async () => {
    const value = Number(amount);
    if (!description.trim()) return toast.error("Write what this was for");
    if (!Number.isFinite(value) || value <= 0) return toast.error("Enter a valid amount");

    setSaving(true);
    try {
      await addFinanceEntry({
        entryDate,
        kind,
        description,
        category,
        amount: round2(value),
        method,
      });
      toast.success(`${kind === "income" ? "Money in" : "Money out"} recorded`);
      setFormOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the entry");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (entry: FinanceEntry) => {
    if (entry.source === "sale") {
      toast.error("This came from a sale — cancel the sale instead so stock is corrected too.");
      return;
    }
    if (!window.confirm(`Delete "${entry.description}"?`)) return;
    try {
      await deleteFinanceEntry(entry.id);
      toast.success("Entry deleted");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the entry");
    }
  };

  const exportCsv = () => {
    downloadFile(
      `money-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        entries.map((entry) => ({
          Date: entry.entryDate,
          Type: entry.kind,
          Description: entry.description,
          Category: entry.category,
          Amount: entry.amount,
          Method: entry.method,
          Source: entry.source,
        })),
      ),
      "text/csv",
    );
  };

  return (
    <AdminShell
      title="Money"
      description="Cash book — everything that comes in and goes out. Sales post here automatically."
      actions={
        <>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => openForm("income")}>
            <ArrowUpCircle className="mr-2 h-4 w-4" />
            Money in
          </Button>
          <Button size="sm" onClick={() => openForm("expense")}>
            <Plus className="mr-2 h-4 w-4" />
            Money out
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Money in"
          value={formatPrice(totals.income)}
          hint={monthFilter === "all" ? "All time" : monthFilter}
          icon={ArrowUpCircle}
          tone="good"
        />
        <StatCard
          label="Money out"
          value={formatPrice(totals.expense)}
          hint={`${formatPrice(totals.inventory)} of it on stock`}
          icon={ArrowDownCircle}
          tone="bad"
        />
        <StatCard
          label="Net cash"
          value={formatPrice(totals.net)}
          hint="In minus out"
          icon={Wallet}
          tone={totals.net >= 0 ? "good" : "bad"}
        />
        <StatCard label="Entries" value={String(visible.length)} hint="In current view" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Month</Label>
                <Select value={monthFilter} onValueChange={setMonthFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All time</SelectItem>
                    {months.map((month) => (
                      <SelectItem key={month} value={month}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Type</Label>
                <Select
                  value={kindFilter}
                  onValueChange={(value) => setKindFilter(value as typeof kindFilter)}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">In and out</SelectItem>
                    <SelectItem value="income">Money in</SelectItem>
                    <SelectItem value="expense">Money out</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">In</TableHead>
                    <TableHead className="text-right">Out</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : visible.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        Nothing recorded for this filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    visible.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {entry.entryDate}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{entry.description}</div>
                          <div className="text-xs text-muted-foreground">
                            {entry.method}
                            {entry.source !== "manual" ? ` · ${entry.source}` : ""}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {entry.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-600">
                          {entry.kind === "income" ? formatPrice(entry.amount) : ""}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-red-600">
                          {entry.kind === "expense" ? formatPrice(entry.amount) : ""}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(entry)}
                            disabled={entry.source === "sale"}
                            title={
                              entry.source === "sale"
                                ? "Comes from a sale — cancel the sale instead"
                                : "Delete"
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete {entry.description}</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Where the money went</CardTitle>
          </CardHeader>
          <CardContent>
            {byCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expenses in this view.</p>
            ) : (
              <ul className="space-y-3">
                {byCategory.map(([name, value]) => {
                  const share = totals.expense > 0 ? (value / totals.expense) * 100 : 0;
                  return (
                    <li key={name}>
                      <div className="flex justify-between text-sm">
                        <span>{name}</span>
                        <span className="tabular-nums">{formatPrice(value)}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${share}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{kind === "income" ? "Money in" : "Money out"}</DialogTitle>
            <DialogDescription>
              {kind === "income"
                ? "Cash received that is not a shop sale — for example a refund from a supplier."
                : "Stock purchases, delivery fees, packaging, transport, anything you paid for."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="entry-date">Date</Label>
                <Input
                  id="entry-date"
                  type="date"
                  value={entryDate}
                  onChange={(event) => setEntryDate(event.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="entry-amount">Amount</Label>
                <Input
                  id="entry-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="entry-description">What was it for?</Label>
              <Input
                id="entry-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={kind === "expense" ? "Buy bra from Loda" : "Supplier refund"}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(kind === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Paid by</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {kind === "expense" && category === "Inventory" ? (
              <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
                Buying stock? Use <strong>Stock → Restock</strong> instead — it adds the units and
                records this expense in one step.
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
