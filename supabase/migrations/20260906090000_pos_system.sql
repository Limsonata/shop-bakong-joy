-- POS + money management schema.
-- Replaces the Clothing_Shop_Management spreadsheet:
--   Stock sheet             -> public.stock_items (+ stock_movements audit trail)
--   Orders / Order2 sheets  -> public.sales + public.sale_items
--   Income & Expenses sheet -> public.finance_entries
--   Profit sheet            -> public.shop_summary view (computed, never typed by hand)
--
-- Everything here is back-office data: RLS allows admins only.

-- ─────────────────────────────────────────────────────────────
-- STOCK ITEMS  (one row per SKU = product + size + color)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.stock_items (
  id         uuid        primary key default gen_random_uuid(),
  sku        text        unique not null,
  name       text        not null,
  category   text        not null default 'Other',
  size       text        not null default 'One size',
  color      text        not null default '',
  cost       numeric     not null default 0 check (cost >= 0),
  price      numeric     not null default 0 check (price >= 0),
  stock_in   integer     not null default 0,
  sold       integer     not null default 0,
  low_stock_at integer   not null default 0 check (low_stock_at >= 0),
  product_id uuid        references public.products(id) on delete set null,
  archived   boolean     not null default false,
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stock_items_name_idx     on public.stock_items (lower(name));
create index if not exists stock_items_category_idx on public.stock_items (category);
create index if not exists stock_items_active_idx   on public.stock_items (archived) where archived = false;

comment on column public.stock_items.stock_in is 'Total units ever received (restocks add to this).';
comment on column public.stock_items.sold     is 'Total units sold. stock_left = stock_in - sold.';

-- ─────────────────────────────────────────────────────────────
-- STOCK MOVEMENTS  (why did stock change?)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.stock_movements (
  id            uuid        primary key default gen_random_uuid(),
  stock_item_id uuid        not null references public.stock_items(id) on delete cascade,
  delta         integer     not null,
  reason        text        not null check (reason in ('restock', 'sale', 'return', 'adjustment', 'loss')),
  unit_cost     numeric,
  reference     text,
  created_by    uuid        references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists stock_movements_item_idx on public.stock_movements (stock_item_id, created_at desc);
create index if not exists stock_movements_date_idx on public.stock_movements (created_at desc);

-- ─────────────────────────────────────────────────────────────
-- SALES  (walk-in sale or booking with a deposit)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.sales (
  id              uuid        primary key default gen_random_uuid(),
  code            text        unique not null,
  sold_at         date        not null default current_date,
  customer_name   text        not null default 'Walk-in customer',
  phone           text        not null default '',
  address         text        not null default '',
  city            text        not null default '',
  channel         text        not null default 'walk-in'
                    check (channel in ('walk-in', 'booking', 'online')),
  delivery_method text        not null default 'Pickup',
  delivery_fee    numeric     not null default 0 check (delivery_fee >= 0),
  delivery_status text        not null default 'preparing'
                    check (delivery_status in ('preparing', 'sent', 'delivered', 'returned')),
  status          text        not null default 'confirmed'
                    check (status in ('confirmed', 'cancelled')),
  subtotal        numeric     not null default 0 check (subtotal >= 0),
  discount        numeric     not null default 0 check (discount >= 0),
  total           numeric     not null default 0 check (total >= 0),
  paid            numeric     not null default 0 check (paid >= 0),
  payment_method  text        not null default 'cash',
  note            text,
  order_id        uuid        references public.orders(id) on delete set null,
  created_by      uuid        references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists sales_sold_at_idx  on public.sales (sold_at desc);
create index if not exists sales_customer_idx on public.sales (lower(customer_name));
create index if not exists sales_unpaid_idx   on public.sales (sold_at desc) where paid < total;

comment on column public.sales.paid  is 'Cash actually received so far (deposit or full payment). balance = total - paid.';
comment on column public.sales.total is 'subtotal - discount + delivery_fee.';

create table if not exists public.sale_items (
  id            uuid        primary key default gen_random_uuid(),
  sale_id       uuid        not null references public.sales(id) on delete cascade,
  stock_item_id uuid        references public.stock_items(id) on delete set null,
  name          text        not null,
  size          text        not null default '',
  color         text        not null default '',
  qty           integer     not null default 1 check (qty > 0),
  unit_price    numeric     not null default 0 check (unit_price >= 0),
  unit_cost     numeric     not null default 0 check (unit_cost >= 0),
  created_at    timestamptz not null default now()
);

create index if not exists sale_items_sale_idx  on public.sale_items (sale_id);
create index if not exists sale_items_stock_idx on public.sale_items (stock_item_id);

comment on column public.sale_items.unit_cost is 'Cost snapshot at time of sale, so profit stays correct when supplier prices change.';

-- ─────────────────────────────────────────────────────────────
-- FINANCE ENTRIES  (cash in / cash out)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.finance_entries (
  id          uuid        primary key default gen_random_uuid(),
  entry_date  date        not null default current_date,
  kind        text        not null check (kind in ('income', 'expense')),
  description text        not null,
  category    text        not null default 'Other',
  amount      numeric     not null check (amount >= 0),
  method      text        not null default 'cash',
  source      text        not null default 'manual' check (source in ('manual', 'sale', 'import')),
  sale_id     uuid        references public.sales(id) on delete set null,
  created_by  uuid        references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists finance_entries_date_idx     on public.finance_entries (entry_date desc);
create index if not exists finance_entries_kind_idx     on public.finance_entries (kind, entry_date desc);
create index if not exists finance_entries_sale_idx     on public.finance_entries (sale_id);

comment on table public.finance_entries is
  'Cash book. Sale payments are posted here automatically (source = sale); purchases and running costs are entered by hand.';

-- ─────────────────────────────────────────────────────────────
-- RECORD A SALE ATOMICALLY
-- Inserts the sale + line items, decrements stock, writes stock
-- movements, and posts the received cash to the ledger — all or nothing.
-- ─────────────────────────────────────────────────────────────
create or replace function public.record_sale(payload jsonb)
returns public.sales
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_sale    public.sales;
  line        jsonb;
  item        public.stock_items;
  line_qty    integer;
  line_price  numeric;
  line_cost   numeric;
  computed    numeric := 0;
  sale_code   text;
begin
  sale_code := coalesce(nullif(payload->>'code', ''),
                        'S-' || to_char(now(), 'YYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 4));

  -- Line items first, so we can validate stock before writing anything visible.
  for line in select * from jsonb_array_elements(coalesce(payload->'items', '[]'::jsonb))
  loop
    line_qty := greatest(coalesce((line->>'qty')::integer, 1), 1);
    if nullif(line->>'stockItemId', '') is not null then
      select * into item from public.stock_items where id = (line->>'stockItemId')::uuid for update;
      if not found then
        raise exception 'Stock item % not found', line->>'stockItemId';
      end if;
      if item.stock_in - item.sold < line_qty then
        raise exception 'Not enough stock for % (% left, % requested)',
          item.name, item.stock_in - item.sold, line_qty;
      end if;
    end if;
    computed := computed + line_qty * coalesce((line->>'unitPrice')::numeric, 0);
  end loop;

  insert into public.sales (
    code, sold_at, customer_name, phone, address, city, channel,
    delivery_method, delivery_fee, delivery_status, status,
    subtotal, discount, total, paid, payment_method, note, created_by
  ) values (
    sale_code,
    coalesce((payload->>'soldAt')::date, current_date),
    coalesce(nullif(payload->>'customerName', ''), 'Walk-in customer'),
    coalesce(payload->>'phone', ''),
    coalesce(payload->>'address', ''),
    coalesce(payload->>'city', ''),
    coalesce(nullif(payload->>'channel', ''), 'walk-in'),
    coalesce(nullif(payload->>'deliveryMethod', ''), 'Pickup'),
    coalesce((payload->>'deliveryFee')::numeric, 0),
    coalesce(nullif(payload->>'deliveryStatus', ''), 'preparing'),
    'confirmed',
    computed,
    coalesce((payload->>'discount')::numeric, 0),
    greatest(computed - coalesce((payload->>'discount')::numeric, 0)
             + coalesce((payload->>'deliveryFee')::numeric, 0), 0),
    coalesce((payload->>'paid')::numeric, 0),
    coalesce(nullif(payload->>'paymentMethod', ''), 'cash'),
    nullif(payload->>'note', ''),
    auth.uid()
  )
  returning * into new_sale;

  for line in select * from jsonb_array_elements(coalesce(payload->'items', '[]'::jsonb))
  loop
    line_qty   := greatest(coalesce((line->>'qty')::integer, 1), 1);
    line_price := coalesce((line->>'unitPrice')::numeric, 0);
    line_cost  := coalesce((line->>'unitCost')::numeric, 0);

    if nullif(line->>'stockItemId', '') is not null then
      select * into item from public.stock_items where id = (line->>'stockItemId')::uuid;
      if line_cost = 0 then
        line_cost := item.cost;
      end if;

      update public.stock_items
         set sold = sold + line_qty, updated_at = now()
       where id = item.id;

      insert into public.stock_movements (stock_item_id, delta, reason, unit_cost, reference)
      values (item.id, -line_qty, 'sale', line_cost, new_sale.code);
    end if;

    insert into public.sale_items (sale_id, stock_item_id, name, size, color, qty, unit_price, unit_cost)
    values (
      new_sale.id,
      nullif(line->>'stockItemId', '')::uuid,
      coalesce(nullif(line->>'name', ''), 'Item'),
      coalesce(line->>'size', ''),
      coalesce(line->>'color', ''),
      line_qty,
      line_price,
      line_cost
    );
  end loop;

  if new_sale.paid > 0 then
    insert into public.finance_entries
      (entry_date, kind, description, category, amount, method, source, sale_id, created_by)
    values (
      new_sale.sold_at, 'income',
      'Sale ' || new_sale.code || ' — ' || new_sale.customer_name,
      'Sales', new_sale.paid, new_sale.payment_method, 'sale', new_sale.id, auth.uid()
    );
  end if;

  return new_sale;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- ADD A PAYMENT to an existing booking (deposit -> fully paid)
-- ─────────────────────────────────────────────────────────────
create or replace function public.record_sale_payment(
  target_sale uuid,
  payment_amount numeric,
  payment_method text default 'cash'
)
returns public.sales
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated public.sales;
begin
  if payment_amount <= 0 then
    raise exception 'Payment must be greater than zero';
  end if;

  update public.sales
     set paid = paid + payment_amount, updated_at = now()
   where id = target_sale
  returning * into updated;

  if not found then
    raise exception 'Sale % not found', target_sale;
  end if;

  insert into public.finance_entries
    (entry_date, kind, description, category, amount, method, source, sale_id, created_by)
  values (
    current_date, 'income',
    'Balance payment ' || updated.code || ' — ' || updated.customer_name,
    'Sales', payment_amount, payment_method, 'sale', updated.id, auth.uid()
  );

  return updated;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- RESTOCK  (receive goods + optionally record the purchase cost)
-- ─────────────────────────────────────────────────────────────
create or replace function public.record_restock(
  target_item uuid,
  quantity integer,
  new_unit_cost numeric default null,
  supplier text default null,
  post_expense boolean default true
)
returns public.stock_items
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated public.stock_items;
  effective_cost numeric;
begin
  if quantity <= 0 then
    raise exception 'Restock quantity must be greater than zero';
  end if;

  select coalesce(new_unit_cost, cost) into effective_cost
    from public.stock_items where id = target_item;
  if effective_cost is null then
    raise exception 'Stock item % not found', target_item;
  end if;

  update public.stock_items
     set stock_in = stock_in + quantity,
         cost = effective_cost,
         updated_at = now()
   where id = target_item
  returning * into updated;

  insert into public.stock_movements (stock_item_id, delta, reason, unit_cost, reference, created_by)
  values (target_item, quantity, 'restock', effective_cost, supplier, auth.uid());

  if post_expense and effective_cost > 0 then
    insert into public.finance_entries
      (entry_date, kind, description, category, amount, method, source, created_by)
    values (
      current_date, 'expense',
      'Restock ' || quantity || ' x ' || updated.name ||
        coalesce(' (' || supplier || ')', ''),
      'Inventory', round(effective_cost * quantity, 2), 'cash', 'manual', auth.uid()
    );
  end if;

  return updated;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- SUMMARY VIEW  (what the Profit sheet used to calculate by hand)
-- ─────────────────────────────────────────────────────────────
create or replace view public.shop_summary
with (security_invoker = true) as
with sale_totals as (
  select
    coalesce(sum(s.subtotal - s.discount), 0) as revenue,
    coalesce(sum(s.delivery_fee), 0)          as delivery_charged,
    coalesce(sum(s.total), 0)                 as billed,
    coalesce(sum(s.paid), 0)                  as collected,
    coalesce(sum(s.total - s.paid), 0)        as outstanding
  from public.sales s
  where s.status = 'confirmed'
),
cogs as (
  select coalesce(sum(si.qty * si.unit_cost), 0) as amount
  from public.sale_items si
  join public.sales s on s.id = si.sale_id and s.status = 'confirmed'
),
ledger as (
  select
    coalesce(sum(amount) filter (where kind = 'income'), 0)                              as cash_in,
    coalesce(sum(amount) filter (where kind = 'expense'), 0)                             as cash_out,
    coalesce(sum(amount) filter (where kind = 'expense' and category = 'Inventory'), 0)  as inventory_spend,
    -- Inventory is already in COGS and refunds belong to cancelled sales whose
    -- revenue is excluded, so neither may reduce profit a second time.
    coalesce(sum(amount) filter (
      where kind = 'expense' and category not in ('Inventory', 'Refund')
    ), 0)                                                                                as running_costs
  from public.finance_entries
),
stock as (
  select
    coalesce(sum(greatest(stock_in - sold, 0)), 0)        as units_left,
    coalesce(sum(greatest(stock_in - sold, 0) * cost), 0) as stock_value,
    coalesce(sum(greatest(stock_in - sold, 0) * price), 0) as potential_sales,
    count(*) filter (where stock_in - sold <= low_stock_at and archived = false) as low_stock_count
  from public.stock_items
  where archived = false
)
select
  sale_totals.revenue,
  sale_totals.delivery_charged,
  sale_totals.billed,
  sale_totals.collected,
  sale_totals.outstanding,
  cogs.amount                                        as cogs,
  sale_totals.revenue - cogs.amount                  as gross_profit,
  ledger.running_costs,
  sale_totals.revenue - cogs.amount - ledger.running_costs as net_profit,
  ledger.cash_in,
  ledger.cash_out,
  ledger.cash_in - ledger.cash_out                   as cash_on_hand,
  ledger.inventory_spend,
  stock.units_left,
  stock.stock_value,
  stock.potential_sales,
  stock.low_stock_count
from sale_totals, cogs, ledger, stock;

-- ─────────────────────────────────────────────────────────────
-- PRIVILEGES + RLS  (back office = admins only)
-- ─────────────────────────────────────────────────────────────
alter table public.stock_items     enable row level security;
alter table public.stock_movements enable row level security;
alter table public.sales           enable row level security;
alter table public.sale_items      enable row level security;
alter table public.finance_entries enable row level security;

grant select, insert, update, delete on table public.stock_items     to authenticated;
grant select, insert, update, delete on table public.stock_movements  to authenticated;
grant select, insert, update, delete on table public.sales            to authenticated;
grant select, insert, update, delete on table public.sale_items       to authenticated;
grant select, insert, update, delete on table public.finance_entries  to authenticated;
grant select on table public.shop_summary to authenticated;

revoke all on table public.stock_items     from anon;
revoke all on table public.stock_movements from anon;
revoke all on table public.sales           from anon;
revoke all on table public.sale_items      from anon;
revoke all on table public.finance_entries from anon;
revoke all on table public.shop_summary    from anon;

do $$
declare
  t text;
begin
  foreach t in array array['stock_items', 'stock_movements', 'sales', 'sale_items', 'finance_entries']
  loop
    execute format('drop policy if exists %I_admin_all on public.%I', t, t);
    execute format(
      'create policy %I_admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t, t
    );
  end loop;
end;
$$;

revoke execute on function public.record_sale(jsonb)                             from public, anon;
revoke execute on function public.record_sale_payment(uuid, numeric, text)       from public, anon;
revoke execute on function public.record_restock(uuid, integer, numeric, text, boolean) from public, anon;
grant  execute on function public.record_sale(jsonb)                             to authenticated;
grant  execute on function public.record_sale_payment(uuid, numeric, text)       to authenticated;
grant  execute on function public.record_restock(uuid, integer, numeric, text, boolean) to authenticated;

notify pgrst, 'reload schema';
