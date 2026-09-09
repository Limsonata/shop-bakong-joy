#!/usr/bin/env python3
"""Create storefront `products` from the imported POS stock (via REST).

Mirrors tools/products_from_stock.py (which writes SQL) using the Supabase
REST API so it works against the live cloud database:
  1. Group stock_items by (name, category)
  2. Upsert one products row per group (handle = slug(name + '-' + category)),
     sizes/colors become variants (selectedOptions), price = lowest in group
  3. Link each group's stock_items.product_id to the product

Idempotent: upserts on the unique handle, re-links product_id, never deletes.
"""
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

BASE = os.environ["SUPABASE_URL"]
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / "src" / "data" / "shop-seed.json"

CATEGORY_TO_TYPE = {
    "Bra & Lingerie": "Lingerie",
    "Underwear": "Underwear",
    "Jeans": "Bottoms",
    "Other": "Apparel",
}


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
            "Prefer": "return=representation,resolution=merge-duplicates",
        },
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode() or "null")


def handle_for(name: str, category: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", f"{name}-{category}".lower()).strip("-")
    return base[:80]


def main() -> None:
    data = json.loads(SEED.read_text(encoding="utf-8"))
    groups: dict[tuple[str, str], list] = defaultdict(list)
    for item in data["stockItems"]:
        groups[(item["name"], item["category"])].append(item)

    created = 0
    for (name, category), rows in sorted(groups.items()):
        handle = handle_for(name, category)
        price = min(r["price"] for r in rows)
        product_type = CATEGORY_TO_TYPE.get(category, category)
        description = (
            f"{name} — {category}. Available in {len(rows)} size/color combination"
            f"{'s' if len(rows) != 1 else ''}."
        )
        collections = ["Women"]
        if category == "Bra & Lingerie":
            collections.append("Lingerie")

        variants = []
        for r in rows:
            title_parts = [p for p in [r.get("size"), r.get("color")] if p]
            selected = [
                {"name": "Size", "value": r["size"]}
                if r.get("size")
                else None,
                {"name": "Color", "value": r["color"]}
                if r.get("color")
                else None,
            ]
            variants.append(
                {
                    "id": r["sku"],
                    "title": " / ".join(title_parts) or "Default",
                    "price": r["price"],
                    "availableForSale": (r["stockIn"] - r["sold"]) > 0,
                    "selectedOptions": [opt for opt in selected if opt],
                }
            )

        in_stock = any((r["stockIn"] - r["sold"]) > 0 for r in rows)
        inserted = rest(
            "POST",
            "/rest/v1/products?on_conflict=handle",
            {
                "handle": handle,
                "title": name,
                "description": description,
                "product_type": product_type,
                "price": price,
                "currency": "USD",
                "image_url": None,
                "in_stock": in_stock,
                "collections": collections,
                "variants": variants,
            },
        )
        product_id = inserted[0]["id"] if inserted else None

        # Link the group's stock rows back to this product.
        rest(
            "PATCH",
            "/rest/v1/stock_items?"
            + urllib.parse.urlencode(
                {"name": f"eq.{name}", "category": f"eq.{category}"}
            ),
            {"product_id": product_id},
        )
        created += 1
        print(f"[product] {handle} — {name} ({category}) — {len(rows)} SKU(s)")

    print(f"done: {created} product groups upserted")


if __name__ == "__main__":
    main()