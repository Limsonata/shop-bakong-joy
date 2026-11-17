-- ─────────────────────────────────────────────────────────────
-- SHOP DATE IN CAMBODIA TIME (Asia/Phnom_Penh, UTC+7)
-- ─────────────────────────────────────────────────────────────
-- Supabase runs in UTC, so `current_date` is "yesterday" in Phnom Penh
-- until 07:00. Balance payments, refunds and restocks recorded before
-- 07:00 landed on the previous day's cash up, and sale codes carried the
-- previous day's date.
--
-- Fix: one helper, public.shop_today(), returns today's date in Phnom Penh.
-- Every POS function and the date column defaults now use it. The function
-- bodies below are copies of the latest versions with ONLY the dates changed:
--   record_sale         ← 20260906090000_pos_system.sql
--   record_sale_payment ← 20260906090000_pos_system.sql
--   cancel_sale         ← 20260906090000_pos_system.sql
--   record_restock      ← 20260908120000_weighted_average_cost.sql
-- Existing rows are not changed.

create or replace function public.shop_today()
returns date
language sql
stable
set search_path = public
as $$
  select (now() at time zone 'Asia/Phnom_Penh')::date;
$$;

comment on function public.shop_today() is
  'Today''s date in the shop''s time zone (Asia/Phnom_Penh). Use instead of current_date, which is UTC.';

revoke execute on function public.shop_today() from public, anon;
grant  execute on function public.shop_today() to authenticated, service_role;

alter table public.sales           alter column sold_at    set default public.shop_today();
alter table public.finance_entries alter column entry_date set default public.shop_today();

-- ─────────────────────────────────────────────────────────────
-- RECORD A SALE ATOMICALLY  (date fallback + sale code date)
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
                        concat('S-', to_char(now() at time zone 'Asia/Phnom_Penh', 'YYMMDD'),
                               '-', substr(gen_random_uuid()::text, 1, 4)));

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
    coalesce((payload->>'soldAt')::date, public.shop_today()),
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
      concat('Sale ', new_sale.code, ' — ', new_sale.customer_name),
      'Sales', new_sale.paid, new_sale.payment_method, 'sale', new_sale.id, auth.uid()
    );
  end if;

  return new_sale;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- ADD A PAYMENT to an existing booking  (cash book date)
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
    public.shop_today(), 'income',
    concat('Balance payment ', updated.code, ' — ', updated.customer_name),
    'Sales', payment_amount, payment_method, 'sale', updated.id, auth.uid()
  );

  return updated;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- RESTOCK with weighted average cost  (cash book date)
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
  updated         public.stock_items;
  v_old_cost      numeric;
  v_units_left    integer;
  v_purchase_cost numeric;
  v_new_cost      numeric;
begin
  if quantity <= 0 then
    raise exception 'Restock quantity must be greater than zero';
  end if;
  if new_unit_cost is not null and new_unit_cost < 0 then
    raise exception 'Unit cost cannot be negative';
  end if;

  select cost, greatest(stock_in - sold, 0)
    into v_old_cost, v_units_left
    from public.stock_items
   where id = target_item;
  if v_old_cost is null then
    raise exception 'Stock item % not found', target_item;
  end if;

  -- Actual price paid for THIS batch (defaults to the current average).
  v_purchase_cost := coalesce(new_unit_cost, v_old_cost);

  -- Blend the units already on hand with the new batch.
  v_new_cost := round(
    (v_units_left * v_old_cost + quantity * v_purchase_cost)
      / (v_units_left + quantity),
    2
  );

  update public.stock_items
     set stock_in = stock_in + quantity,
         cost = v_new_cost,
         updated_at = now()
   where id = target_item
  returning * into updated;

  -- Audit trail keeps the real price of this purchase batch.
  insert into public.stock_movements (stock_item_id, delta, reason, unit_cost, reference, created_by)
  values (target_item, quantity, 'restock', v_purchase_cost, supplier, auth.uid());

  if post_expense and v_purchase_cost > 0 then
    insert into public.finance_entries
      (entry_date, kind, description, category, amount, method, source, created_by)
    values (
      public.shop_today(), 'expense',
      concat('Restock ', quantity, ' x ', updated.name,
        case when supplier is null then '' else concat(' (', supplier, ')') end),
      'Inventory', round(v_purchase_cost * quantity, 2), 'cash', 'manual', auth.uid()
    );
  end if;

  return updated;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- CANCEL A SALE ATOMICALLY  (refund date)
-- ─────────────────────────────────────────────────────────────
create or replace function public.cancel_sale(target_sale uuid)
returns public.sales
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated public.sales;
  line    public.sale_items;
  item    public.stock_items;
begin
  select * into updated from public.sales where id = target_sale for update;
  if not found then
    raise exception 'Sale % not found', target_sale;
  end if;

  if updated.status = 'cancelled' then
    return updated;
  end if;

  for line in select * from public.sale_items where sale_id = target_sale
  loop
    if line.stock_item_id is null then
      continue;
    end if;

    select * into item from public.stock_items where id = line.stock_item_id for update;
    if not found then
      continue;
    end if;

    update public.stock_items
       set sold = greatest(sold - line.qty, 0), updated_at = now()
     where id = item.id;

    insert into public.stock_movements (stock_item_id, delta, reason, reference, created_by)
    values (item.id, line.qty, 'return', concat('cancel ', updated.code), auth.uid());
  end loop;

  if updated.paid > 0 then
    insert into public.finance_entries
      (entry_date, kind, description, category, amount, method, source, sale_id, created_by)
    values (
      public.shop_today(), 'expense',
      concat('Refund ', updated.code, ' — ', updated.customer_name),
      'Refund', updated.paid, updated.payment_method, 'sale', updated.id, auth.uid()
    );
  end if;

  update public.sales
     set status = 'cancelled', updated_at = now()
   where id = target_sale
  returning * into updated;

  return updated;
end;
$$;

notify pgrst, 'reload schema';
