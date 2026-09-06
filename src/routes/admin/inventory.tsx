import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  DollarSign,
  Download,
  PackagePlus,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  TrendingUp,
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
import { Switch } from "@/components/ui/switch";
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
  createStockItem,
  downloadFile,
  listStockItems,
  restockItem,
  toCsv,
  updateStockItem,
} from "@/lib/pos/store";
import { isLowStock, round2, stockLeft, type StockItem } from "@/lib/pos/types";

export const Route = createFileRoute("/admin/inventory")({
  head: () => ({ meta: [{ title: "Stock - Admin" }] }),
  component: InventoryPage,
});

const SIZE_SUGGESTIONS = ["Free size", "S", "M", "L", "XL", "32", "34", "36", "38", "40"];
const CATEGORY_SUGGESTIONS = ["Bra & Lingerie", "Underwear", "Tops", "Jeans", "Other"];

interface ItemFormState {
  name: string;
  category: string;
  size: string;
  color: string;
  cost: string;
  price: string;
  stockIn: string;
  lowStockAt: string;
  note: string;
}

const EMPTY_FORM: ItemFormState = {
  name: "",
  category: "Bra & Lingerie",
  size: "Free size",
  color: "",
  cost: "",
  price: "",
  stockIn: "1",
  lowStockAt: "0",
  note: "",
};

function toForm(item: StockItem): ItemFormState {
  return {
    name: item.name,
    category: item.category,
    size: item.size,
    color: item.color,
    cost: String(item.cost),
    price: String(item.price),
    stockIn: String(item.stockIn),
    lowStockAt: String(item.lowStockAt),
    note: item.note,
  };
}

function InventoryPage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const [editing, setEditing] = useState<StockItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ItemFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [restockTarget, setRestockTarget] = useState<StockItem | null>(null);
  const [restockQty, setRestockQty] = useState("1");
  const [restockCost, setRestockCost] = useState("");
  const [restockSupplier, setRestockSupplier] = useState("");
  const [restockPostExpense, setRestockPostExpense] = useState(true);

  const load = async () => {
    setIsLoading(true);
    try {
      setItems(await listStockItems(true));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load stock");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(items.map((item) => item.category))).sort(),
    [items],
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      if (!showArchived && item.archived) return false;
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (onlyLowStock && !isLowStock(item)) return false;
      if (!term) return true;
      return [item.sku, item.name, item.size, item.color, item.category]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [items, search, categoryFilter, onlyLowStock, showArchived]);

  const totals = useMemo(() => {
    const active = items.filter((item) => !item.archived);
    return {
      skus: active.length,
      units: active.reduce((sum, item) => sum + Math.max(stockLeft(item), 0), 0),
      value: round2(
        active.reduce((sum, item) => sum + Math.max(stockLeft(item), 0) * item.cost, 0),
      ),
      potential: round2(
        active.reduce((sum, item) => sum + Math.max(stockLeft(item), 0) * item.price, 0),
      ),
      low: active.filter(isLowStock).length,
    };
  }, [items]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (item: StockItem) => {
    setEditing(item);
    setForm(toForm(item));
    setFormOpen(true);
  };

  const submitForm = async () => {
    const cost = Number(form.cost);
    const price = Number(form.price);
    const stockIn = Number(form.stockIn);

    if (!form.name.trim()) return toast.error("Item name is required");
    if (!Number.isFinite(cost) || cost < 0) return toast.error("Cost must be a positive number");
    if (!Number.isFinite(price) || price < 0) return toast.error("Price must be a positive number");
    if (!Number.isInteger(stockIn) || stockIn < 0)
      return toast.error("Quantity must be a whole number");

    setSaving(true);
    try {
      const payload = {
        name: form.name,
        category: form.category,
        size: form.size,
        color: form.color,
        cost,
        price,
        stockIn,
        lowStockAt: Math.max(Number(form.lowStockAt) || 0, 0),
        note: form.note,
      };
      if (editing) {
        await updateStockItem(editing.id, payload);
        toast.success(`${form.name} updated`);
      } else {
        const created = await createStockItem(payload);
        toast.success(`${created.sku} added`);
      }
      setFormOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the item");
    } finally {
      setSaving(false);
    }
  };

  const openRestock = (item: StockItem) => {
    setRestockTarget(item);
    setRestockQty("1");
    setRestockCost(String(item.cost));
    setRestockSupplier("");
    setRestockPostExpense(true);
  };

  const submitRestock = async () => {
    if (!restockTarget) return;
    const quantity = Number(restockQty);
    const unitCost = Number(restockCost);
    if (!Number.isInteger(quantity) || quantity <= 0) return toast.error("Enter a whole quantity");
    if (!Number.isFinite(unitCost) || unitCost < 0) return toast.error("Enter a valid unit cost");

    setSaving(true);
    try {
      await restockItem({
        stockItemId: restockTarget.id,
        quantity,
        unitCost,
        supplier: restockSupplier.trim() || undefined,
        postExpense: restockPostExpense,
      });
      toast.success(
        restockPostExpense
          ? `Added ${quantity} × ${restockTarget.name} and recorded ${formatPrice(unitCost * quantity)} expense`
          : `Added ${quantity} × ${restockTarget.name}`,
      );
      setRestockTarget(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record the restock");
    } finally {
      setSaving(false);
    }
  };

  const toggleArchive = async (item: StockItem) => {
    try {
      await updateStockItem(item.id, { archived: !item.archived });
      toast.success(item.archived ? `${item.sku} restored` : `${item.sku} archived`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the item");
    }
  };

  const exportCsv = () => {
    downloadFile(
      `stock-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        items.map((item) => ({
          SKU: item.sku,
          Item: item.name,
          Category: item.category,
          Size: item.size,
          Color: item.color,
          Cost: item.cost,
          Price: item.price,
          "Stock in": item.stockIn,
          Sold: item.sold,
          "Stock left": stockLeft(item),
          "Stock value": round2(stockLeft(item) * item.cost),
          "Profit per item": round2(item.price - item.cost),
          Archived: item.archived ? "yes" : "no",
        })),
      ),
      "text/csv",
    );
  };

  return (
    <AdminShell
      title="Stock"
      description="Every SKU, what it cost, what it sells for, and how many are left."
      actions={
        <>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add item
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Units in stock"
          value={String(totals.units)}
          hint={`${totals.skus} SKUs`}
          icon={Boxes}
        />
        <StatCard
          label="Stock value (cost)"
          value={formatPrice(totals.value)}
          hint="Money sitting on the shelf"
          icon={DollarSign}
        />
        <StatCard
          label="Potential sales"
          value={formatPrice(totals.potential)}
          hint={`${formatPrice(totals.potential - totals.value)} profit if all sells`}
          icon={TrendingUp}
          tone="good"
        />
        <StatCard
          label="Low stock"
          value={String(totals.low)}
          hint="At or below the alert level"
          icon={AlertTriangle}
          tone={totals.low > 0 ? "warn" : "default"}
        />
      </div>

      <Card className="mt-6">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <Label htmlFor="stock-search" className="text-xs text-muted-foreground">
                Search
              </Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="stock-search"
                  className="pl-8"
                  placeholder="SKU, name, size, colour…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <label className="flex items-center gap-2 pb-2 text-sm">
              <Switch checked={onlyLowStock} onCheckedChange={setOnlyLowStock} />
              Low stock only
            </label>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <Switch checked={showArchived} onCheckedChange={setShowArchived} />
              Show archived
            </label>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">In</TableHead>
                  <TableHead className="text-right">Sold</TableHead>
                  <TableHead className="text-right">Left</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                      Loading stock…
                    </TableCell>
                  </TableRow>
                ) : visible.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                      No items match this filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  visible.map((item) => {
                    const left = stockLeft(item);
                    return (
                      <TableRow key={item.id} className={item.archived ? "opacity-50" : undefined}>
                        <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                        <TableCell>
                          <div className="font-medium">{item.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {[item.size, item.color, item.category].filter(Boolean).join(" · ")}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatPrice(item.cost)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatPrice(item.price)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-600">
                          {formatPrice(item.price - item.cost)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{item.stockIn}</TableCell>
                        <TableCell className="text-right tabular-nums">{item.sold}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {left <= 0 ? (
                            <Badge variant="outline" className="border-red-200 text-red-700">
                              {left}
                            </Badge>
                          ) : isLowStock(item) ? (
                            <Badge variant="outline" className="border-amber-200 text-amber-700">
                              {left}
                            </Badge>
                          ) : (
                            left
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatPrice(Math.max(left, 0) * item.cost)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openRestock(item)}
                              title="Restock"
                            >
                              <PackagePlus className="h-4 w-4" />
                              <span className="sr-only">Restock {item.sku}</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(item)}
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">Edit {item.sku}</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs"
                              onClick={() => toggleArchive(item)}
                            >
                              {item.archived ? "Restore" : "Archive"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add / edit item */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.sku}` : "Add stock item"}</DialogTitle>
            <DialogDescription>
              One row per size and colour, the same way the stock sheet worked.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="item-name">Item name</Label>
              <Input
                id="item-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="French-Style Lace Lingerie"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="item-category">Category</Label>
                <Input
                  id="item-category"
                  list="category-options"
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                />
                <datalist id="category-options">
                  {[...new Set([...CATEGORY_SUGGESTIONS, ...categories])].map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="item-size">Size</Label>
                <Input
                  id="item-size"
                  list="size-options"
                  value={form.size}
                  onChange={(event) => setForm({ ...form, size: event.target.value })}
                />
                <datalist id="size-options">
                  {SIZE_SUGGESTIONS.map((size) => (
                    <option key={size} value={size} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="item-color">Colour</Label>
                <Input
                  id="item-color"
                  value={form.color}
                  onChange={(event) => setForm({ ...form, color: event.target.value })}
                  placeholder="Black"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="item-low">Alert when left ≤</Label>
                <Input
                  id="item-low"
                  type="number"
                  min="0"
                  value={form.lowStockAt}
                  onChange={(event) => setForm({ ...form, lowStockAt: event.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="item-cost">Cost / item</Label>
                <Input
                  id="item-cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.cost}
                  onChange={(event) => setForm({ ...form, cost: event.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="item-price">Selling price</Label>
                <Input
                  id="item-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={(event) => setForm({ ...form, price: event.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="item-qty">{editing ? "Total received" : "Quantity"}</Label>
                <Input
                  id="item-qty"
                  type="number"
                  min="0"
                  value={form.stockIn}
                  onChange={(event) => setForm({ ...form, stockIn: event.target.value })}
                />
              </div>
            </div>

            {Number(form.price) > 0 && Number(form.cost) > 0 ? (
              <p className="text-xs text-muted-foreground">
                Profit per item {formatPrice(Number(form.price) - Number(form.cost))} ·{" "}
                {(((Number(form.price) - Number(form.cost)) / Number(form.price)) * 100).toFixed(0)}
                % margin
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submitForm} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restock */}
      <Dialog
        open={restockTarget !== null}
        onOpenChange={(open) => !open && setRestockTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Restock {restockTarget?.sku}</DialogTitle>
            <DialogDescription>
              {restockTarget
                ? `${restockTarget.name} · ${restockTarget.size} · ${restockTarget.color || "no colour"} — ${stockLeft(restockTarget)} left`
                : null}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="restock-qty">Quantity received</Label>
                <Input
                  id="restock-qty"
                  type="number"
                  min="1"
                  value={restockQty}
                  onChange={(event) => setRestockQty(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="restock-cost">Cost per item</Label>
                <Input
                  id="restock-cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={restockCost}
                  onChange={(event) => setRestockCost(event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="restock-supplier">Supplier (optional)</Label>
              <Input
                id="restock-supplier"
                value={restockSupplier}
                onChange={(event) => setRestockSupplier(event.target.value)}
                placeholder="1688, Loda, Blue store…"
              />
            </div>

            <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
              <Switch checked={restockPostExpense} onCheckedChange={setRestockPostExpense} />
              <span>
                Record as an expense in Money
                <span className="block text-xs text-muted-foreground">
                  {formatPrice((Number(restockQty) || 0) * (Number(restockCost) || 0))} will be
                  added to the cash book as Inventory.
                </span>
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRestockTarget(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submitRestock} disabled={saving}>
              {saving ? "Saving…" : "Add stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
