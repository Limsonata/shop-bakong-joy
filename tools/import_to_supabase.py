#!/usr/bin/env python3
"""Import the parsed spreadsheet data (src/data/shop-seed.json) into Supabase.

Reads the JSON produced by tools/import_excel.py and inserts, in order:
  1. stock_items        (sku, cost, price, stock_in, sold)
  2. stock_movements    (one "initial stock" restock per item)
  3. sales              (historical, sold counts already reflected in stock)
  4. sale_items         (linked to stock rows by SKU where possible)
  5. finance_entries    (source = "import")

Safety: refuses to run unless the target tables are empty (pass --force to
override — it still snapshots existing rows to data-backups/ first).
"""
import json
import os
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

BASE = os.environ["SUPABASE_URL"]
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / "src" / "data" / "shop-seed.json"
BACKUP_DIR = ROOT / "data-backups"

GUARD_TABLES = ["stock_items", "sale_items", "sales", "finance_entries", "stock_movements"]


def rest(method: str, path: str, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        BASE + path,
        method=method,
        data=data,
        headers={
            "apikey": KEY,
            "Authorization": f"Bearer {KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode() or "null")


def count(table: str) -> int:
    req = urllib.request.Request(
        f"{BASE}/rest/v1/{table}?select=*",
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}", "Prefer": "count=exact", "Range": "0-0"},
    )
    with urllib.request.urlopen(req) as resp:
        return int(resp.headers.get("Content-Range", "*/0").split("/")[-1])


def chunked(rows, size=200):
    for i in range(0, len(rows), size):
        yield rows[i : i + size]


def main() -> None:
    force = "--force" in sys.argv
    seed = json.loads(SEED.read_text(encoding="utf-8"))

    # ── safety guards ────────────────────────────────────────────────────
    existing = {t: count(t) for t in GUARD_TABLES}
    print("[check] current rows:", existing)
    if any(existing.values()):
        if not force:
            sys.exit("Target tables are not empty. Re-run with --force to back up + wipe first.")
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        BACKUP_DIR.mkdir(exist_ok=True)
        backup = {"generatedAt": datetime.now().isoformat(), "tables": {}}
        for t in GUARD_TABLES:
            backup["tables"][t] = rest("GET", f"/rest/v1/{t}?select=*")
        backup_path = BACKUP_DIR / f"pre-import-{stamp}.json"
        backup_path.write_text(json.dumps(backup, ensure_ascii=False, indent=2))
        print(f"[backup] existing rows -> {backup_path}")
        for t in GUARD_TABLES:
            if existing[t]:
                rest("DELETE", f"/rest/v1/{t}?id=not.is.null")
        print("[wipe] tables cleared")

    stock = seed["stockItems"]
    sales = seed["sales"]
    finance = seed["financeEntries"]

    # ── 1. stock_items ───────────────────────────────────────────────────
    sku_to_id: dict = {}
    for batch in chunked(stock):
        rows = rest(
            "POST",
            "/rest/v1/stock_items?select=id,sku",
            [
                {
                    "sku": item["sku"],
                    "name": item["name"],
                    "category": item["category"],
                    "size": item["size"],
                    "color": item["color"],
                    "cost": item["cost"],
                    "price": item["price"],
                    "stock_in": item["stockIn"],
                    "sold": item["sold"],
                    "low_stock_at": 0,
                    "archived": False,
                    "note": "Imported from spreadsheet",
                }
                for item in batch
            ],
        )
        for row in rows:
            sku_to_id[row["sku"]] = row["id"]
    print(f"[stock] inserted {len(sku_to_id)} stock items")

    # ── 2. initial stock movements ───────────────────────────────────────
    movements = [
        {
            "stock_item_id": sku_to_id[item["sku"]],
            "delta": item["stockIn"],
            "reason": "restock",
            "unit_cost": item["cost"],
            "reference": "initial stock (import)",
        }
        for item in stock
        if item["stockIn"] > 0
    ]
    for batch in chunked(movements):
        rest("POST", "/rest/v1/stock_movements", batch)
    print(f"[movements] inserted {len(movements)} initial-stock movements")

    # ── 3. sales ─────────────────────────────────────────────────────────
    code_to_id: dict = {}
    for batch in chunked(sales):
        rows = rest(
            "POST",
            "/rest/v1/sales?select=id,code",
            [
                {
                    "code": s["code"],
                    "sold_at": s["date"],
                    "customer_name": s["customerName"],
                    "phone": s["phone"],
                    "address": s["address"],
                    "city": s["city"],
                    "channel": s["channel"],
                    "delivery_method": s["deliveryMethod"],
                    "delivery_fee": s["deliveryFee"],
                    "delivery_status": s["deliveryStatus"],
                    "status": s["status"],
                    "subtotal": s["subtotal"],
                    "discount": 0,
                    "total": s["total"],
                    "paid": s["paid"],
                    "payment_method": "cash",
                    "note": s.get("note", ""),
                    "created_at": f"{s['date']}T09:00:00Z",
                }
                for s in batch
            ],
        )
        for row in rows:
            code_to_id[row["code"]] = row["id"]
    print(f"[sales] inserted {len(code_to_id)} sales")

    # ── 4. sale_items ────────────────────────────────────────────────────
    items = [
        {
            "sale_id": code_to_id[s["code"]],
            "stock_item_id": sku_to_id.get(line["sku"]) if line.get("sku") else None,
            "name": line["name"],
            "size": line["size"],
            "color": line["color"],
            "qty": line["qty"],
            "unit_price": line["unitPrice"],
            "unit_cost": line["unitCost"],
        }
        for s in sales
        for line in s["items"]
    ]
    for batch in chunked(items):
        rest("POST", "/rest/v1/sale_items", batch)
    print(f"[sale_items] inserted {len(items)} lines")

    # ── 5. finance_entries ───────────────────────────────────────────────
    entries = [
        {
            "entry_date": f["date"],
            "kind": f["kind"],
            "description": f["description"],
            "category": f["category"],
            "amount": f["amount"],
            "method": f["method"] or "cash",
            "source": "import",
            "sale_id": None,
            "created_at": f"{f['date']}T09:00:00Z",
        }
        for f in finance
    ]
    for batch in chunked(entries):
        rest("POST", "/rest/v1/finance_entries", batch)
    print(f"[finance] inserted {len(entries)} entries")

    # ── verify ───────────────────────────────────────────────────────────
    print("[verify]")
    for t in GUARD_TABLES:
        print(f"  {t}: {count(t)}")


if __name__ == "__main__":
    main()
