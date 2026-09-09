#!/usr/bin/env python3
"""Wipe admin dashboard data (POS + website orders) from Supabase.

Backs up every row to a timestamped JSON file first, then deletes all rows
from: stock_items, stock_movements, sale_items, sales, finance_entries, orders.
"""
import json
import os
import sys
import urllib.request
from datetime import datetime

BASE = os.environ["SUPABASE_URL"]
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
TABLES = [
    "stock_movements",   # deleted first: references stock items
    "sale_items",        # deleted before sales
    "sales",
    "finance_entries",
    "stock_items",
    "orders",
]

# Directory: project_root/data-backups (kept out of git via .gitignore)
BACKUP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data-backups")


def request(method: str, path: str, expect: int = 200) -> object:
    req = urllib.request.Request(
        BASE + path,
        method=method,
        headers={
            "apikey": KEY,
            "Authorization": f"Bearer {KEY}",
            "Prefer": "return=representation",
        },
    )
    with urllib.request.urlopen(req) as resp:
        body = resp.read().decode("utf-8")
        status = resp.status
    if expect != 0 and status != expect:
        raise RuntimeError(f"{method} {path} -> HTTP {status}: {body[:500]}")
    return json.loads(body) if body.strip() else None


def count(table: str) -> int:
    req = urllib.request.Request(
        f"{BASE}/rest/v1/{table}?select=*",
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}", "Prefer": "count=exact", "Range": "0-0"},
    )
    with urllib.request.urlopen(req) as resp:
        return int(resp.headers.get("Content-Range", "*/0").split("/")[-1])


def main() -> None:
    os.makedirs(BACKUP_DIR, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = os.path.join(BACKUP_DIR, f"dashboard-backup-{stamp}.json")

    # 1. Backup
    backup = {"generatedAt": datetime.now().isoformat(), "tables": {}}
    for table in TABLES:
        rows = request("GET", f"/rest/v1/{table}?select=*")
        backup["tables"][table] = rows
        print(f"[backup] {table}: {len(rows)} rows")
    with open(backup_path, "w", encoding="utf-8") as fh:
        json.dump(backup, fh, indent=2, ensure_ascii=False)
    print(f"[backup] saved -> {backup_path}")

    if "--dry-run" in sys.argv:
        print("[dry-run] stopping before delete")
        return

    # 2. Delete all rows (id=not.is.null matches everything)
    for table in TABLES:
        deleted = request("DELETE", f"/rest/v1/{table}?id=not.is.null", expect=200)
        print(f"[delete] {table}: {len(deleted) if deleted else 0} rows deleted")

    # 3. Verify
    print("[verify]")
    for table in TABLES:
        print(f"  {table}: {count(table)} rows remaining")


if __name__ == "__main__":
    main()
