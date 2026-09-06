# POS & Money — replacing the spreadsheet

Your `Clothing_Shop_Management3.xlsx` workbook is now part of the admin dashboard.
Everything the four sheets did is a page you click instead of a formula you type.

| Old sheet | New page | What changed |
| --- | --- | --- |
| Stock | **Stock** (`/admin/inventory`) | Stock left, stock value, profit per item and low-stock alerts are calculated for you |
| Orders / Order2 | **New sale** (`/admin/pos`) + **Sales** (`/admin/sales`) | One order can hold many items without repeating the order ID; deposits and balances are tracked |
| Income & Expenses | **Money** (`/admin/finance`) | Sales and restocks post themselves; you only type real out-of-pocket costs |
| Profit | **Dashboard** + **Reports** | Recalculated live — no more hand-typed totals |

Your existing data was imported: **47 stock items, 19 sales (41 lines), 29 cash entries**.

---

## Running it

```bash
cd shop-bakong-joy
npm install      # first time only
npm run dev
```

Open http://localhost:8080/admin (the port shifts to 8081 if 8080 is busy) and log in.
Without Supabase configured, the demo admin is `admin@shop.com` / `admin123`.

---

## Daily routine

**A customer buys something** → *New sale*. Search the item, click it (click again for 2, 3…),
press **Paid in full**, **Save sale**. Stock drops and the money lands in the cash book.

**A customer books with a deposit** → same screen, set *Type* to **Booking**, type what they
actually handed over in *Received now*, add the delivery fee and address. The balance shows up in
red on the Dashboard until they pay.

**They pay the rest** → *Sales* → **Take payment**.

**New goods arrive** → *Stock* → the box icon on the row → quantity, cost, supplier.
Leave *Record as an expense* on and it writes the purchase into Money for you.
A brand-new item you have never sold → **Add item**.

**Any other cost** (packaging, transport, phone top-up) → *Money* → **Money out**.

**Order cancelled** → *Sales* → open the row → **Cancel sale**. Stock returns to the shelf and any
money received is recorded as a refund, so both profit and cash end up exactly where they were.

---

## Reading the numbers

Two separate questions, deliberately kept apart:

- **Profit** — Revenue − cost of the goods sold − running costs. Stock purchases are *not* subtracted
  here, because the cost of each item is already counted when it sells. Otherwise stock would be
  charged twice.
- **Cash** — What physically came in and went out. Buying $50 of stock cuts your cash today but does
  not cut profit; it becomes profit when the goods sell.

This is why cash on hand can be negative while profit is healthy: money is tied up in stock.
*Stock value* on the Stock page tells you how much.

Low-stock alerts fire when an item is sold out. To be warned earlier, edit the item and set
*Alert when left ≤* to 1 or 2.

---

## Backups — read this if you have not connected Supabase

Without Supabase, everything lives in **this browser on this computer only**. Clearing browsing data
wipes it, and your phone will not see it.

Every week: *Reports* → **Download backup**. Keep the file in Google Drive or Telegram.
**Restore backup** brings it back.

## Connecting Supabase (cloud sync, works on your phone)

Your project is already linked: **ecommerce** (`lpwjtehaiujkygyfyahu`).

1. Open the Supabase dashboard → **SQL Editor** → New query.
2. Paste the whole of `supabase/migrations/20260906090000_pos_system.sql`, Run.
   Creates the tables, security rules and profit calculations.
3. New query → paste `supabase/migrations/20260906090100_pos_seed.sql`, Run.
   Loads your spreadsheet data. Both files are safe to run twice — nothing duplicates.
4. Copy `.env.local.example` to `.env.local` and paste your anon key
   (dashboard → Project Settings → API → Project API keys → `anon` / `public`).
5. Restart `npm run dev`. The orange "offline mode" bar disappears.

Both files were tested end to end against a local PostgreSQL 17 (same major version as your
project): schema, seed, `record_sale`, `record_sale_payment` and `record_restock` all ran clean, and
the `shop_summary` view returns exactly the same 13 figures the app calculates in the browser.

The new tables are locked to admin accounts only (row-level security), so customers browsing the shop
can never read your costs, profit or supplier prices.

### Which numbers you should see afterwards

If the import worked, the Dashboard and Reports will show:

| | |
| --- | --- |
| Revenue | $197.25 |
| Cost of goods | $43.02 |
| Gross profit | $154.23 (78% margin) |
| Net profit | $152.74 |
| Cash on hand | −$12.35 |
| Owed by customers | $65.00 |
| Stock: units / value / potential | 52 / $96.97 / $238.75 |

---

## Re-importing the spreadsheet

Only needed if you keep using Excel alongside for a while:

```bash
python3 -m venv .venv && .venv/bin/pip install openpyxl
.venv/bin/python tools/import_excel.py ~/Downloads/Clothing_Shop_Management3.xlsx
```

This regenerates `src/data/shop-seed.json` and the seed SQL. It skips the leftover
template rows in the workbook (the "Basic T-Shirt" stock row and the "Sample" expense),
which is why the imported expense total is $166.60 rather than the $171.60 the sheet showed.
