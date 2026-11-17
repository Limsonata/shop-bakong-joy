-- Shop tools:
--  1. Audit log: who changed a price, stock level, order status or sale, and when.
--  2. Partial returns for any sale (in-store or online), not only full cancellation.
--  3. Atomic stock adjustment (count / damaged / lost) in one transaction.
-- Safe to run more than once.
begin;

-- ─────────────────────────────────────────────────────────────
-- 1. AUDIT LOG
-- ─────────────────────────────────────────────────────────────
-- Browser writes are attributed through auth.uid(). Server writes (service
-- role, Telegram buttons, automatic KHQR) put a label or an admin's user id
-- in `changed_by` on the row they write; the trigger reads it, logs it and
-- clears it, so it never goes stale for the next change.

alter table public.audit_log add column if not exists actor text;
alter table public.audit_log add column if not exists label text;

alter table public.products    add column if not exists changed_by text;
alter table public.stock_items add column if not exists changed_by text;
alter table public.orders      add column if not exists changed_by text;
alter table public.sales       add column if not exists changed_by text;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_json  jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  new_json  jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  row_json  jsonb := coalesce(new_json, old_json);
  old_diff  jsonb := '{}'::jsonb;
  new_diff  jsonb := '{}'::jsonb;
  col       text;
  given     text  := case when tg_op <> 'DELETE' then new_json->>'changed_by' end;
  who_id    uuid;
  who_label text;
begin
  foreach col in array tg_argv loop
    if tg_op = 'UPDATE' then
      if (old_json->col) is distinct from (new_json->col) then
        old_diff := old_diff || jsonb_build_object(col, old_json->col);
        new_diff := new_diff || jsonb_build_object(col, new_json->col);
      end if;
    elsif tg_op = 'INSERT' then
      new_diff := new_diff || jsonb_build_object(col, new_json->col);
    else
      old_diff := old_diff || jsonb_build_object(col, old_json->col);
    end if;
  end loop;

  if tg_op <> 'UPDATE' or new_diff <> '{}'::jsonb then
    if given ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      who_id := given::uuid;
    else
      who_id := auth.uid();
      who_label := given;
    end if;
    if who_id is not null then
      select coalesce(nullif(p.name, ''), 'Admin') into who_label from public.profiles p where p.id = who_id;
    end if;

    insert into public.audit_log (admin_id, actor, action, table_name, record_id, label, old_data, new_data)
    values (
      who_id,
      coalesce(who_label, case when who_id is null then 'system' else 'Admin' end),
      lower(tg_op),
      tg_table_name,
      (row_json->>'id')::uuid,
      coalesce(row_json->>'title', row_json->>'name', row_json->>'code', row_json->>'bakong_reference',
               left(row_json->>'id', 8)),
      nullif(old_diff, '{}'::jsonb),
      nullif(new_diff, '{}'::jsonb)
    );
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  new.changed_by := null;
  return new;
end;
$$;

revoke execute on function public.audit_row_change() from public, anon, authenticated;

drop trigger if exists audit_products on public.products;
create trigger audit_products
  before insert or update or delete on public.products
  for each row execute function public.audit_row_change('title', 'price', 'in_stock');

drop trigger if exists audit_stock_items on public.stock_items;
create trigger audit_stock_items
  before insert or update or delete on public.stock_items
  for each row execute function public.audit_row_change('price', 'cost', 'stock_in', 'low_stock_at', 'archived');

drop trigger if exists audit_orders on public.orders;
create trigger audit_orders
  before update or delete on public.orders
  for each row execute function public.audit_row_change('status', 'total');

drop trigger if exists audit_sales on public.sales;
create trigger audit_sales
  before update or delete on public.sales
  for each row execute function public.audit_row_change('status', 'paid', 'discount', 'total', 'delivery_status');

-- ─────────────────────────────────────────────────────────────
-- 2. PARTIAL RETURNS
-- ─────────────────────────────────────────────────────────────
-- Returned units come off the line (qty) and are kept in returned_qty, so
-- revenue, cost of goods and profit everywhere stay right without changes.
-- Money: only what the customer overpaid against the new total is refunded.

alter table public.sale_items add column if not exists returned_qty integer not null default 0;
alter table public.sale_items drop constraint if exists sale_items_qty_check;
alter table public.sale_items add constraint sale_items_qty_check check (qty >= 0);
alter table public.sale_items drop constraint if exists sale_items_returned_qty_check;
alter table public.sale_items add constraint sale_items_returned_qty_check check (returned_qty >= 0);

create or replace function public.return_sale_items(
  target_sale uuid,
  lines jsonb,
  p_refund_method text default null,
  p_note text default null
)
returns public.sales
language plpgsql
security invoker
set search_path = public
as $$
declare
  sale        public.sales;
  line        jsonb;
  item_row    public.sale_items;
  return_qty  integer;
  returned    numeric := 0;
  new_sub     numeric;
  new_disc    numeric;
  new_total   numeric;
  refund      numeric;
begin
  select * into sale from public.sales where id = target_sale for update;
  if not found then
    raise exception 'Sale % not found', target_sale;
  end if;
  if sale.status = 'cancelled' then
    raise exception 'Sale % is cancelled', sale.code;
  end if;

  for line in select * from jsonb_array_elements(coalesce(lines, '[]'::jsonb))
  loop
    return_qty := coalesce((line->>'qty')::integer, 0);
    if return_qty <= 0 then
      continue;
    end if;
    select * into item_row from public.sale_items
     where id = (line->>'saleItemId')::uuid and sale_id = target_sale
     for update;
    if not found then
      raise exception 'Item % is not on sale %', line->>'saleItemId', sale.code;
    end if;
    if return_qty > item_row.qty then
      raise exception 'Only % of % can be returned', item_row.qty, item_row.name;
    end if;

    update public.sale_items
       set qty = qty - return_qty, returned_qty = returned_qty + return_qty
     where id = item_row.id;

    if item_row.stock_item_id is not null then
      update public.stock_items
         set sold = greatest(sold - return_qty, 0), updated_at = now()
       where id = item_row.stock_item_id;
      insert into public.stock_movements (stock_item_id, delta, reason, unit_cost, reference, created_by)
      values (item_row.stock_item_id, return_qty, 'return', item_row.unit_cost,
              'return ' || sale.code || coalesce(' — ' || nullif(p_note, ''), ''), auth.uid());
    end if;

    returned := returned + return_qty * item_row.unit_price;
  end loop;

  if returned = 0 then
    raise exception 'Choose at least one item to return';
  end if;

  new_sub   := greatest(sale.subtotal - returned, 0);
  new_disc  := least(sale.discount, new_sub);
  new_total := greatest(new_sub - new_disc + sale.delivery_fee, 0);
  refund    := greatest(sale.paid - new_total, 0);

  update public.sales
     set subtotal = new_sub,
         discount = new_disc,
         total    = new_total,
         paid     = paid - refund,
         note     = concat_ws(E'\n', nullif(sale.note, ''),
                      'Returned ' || to_char(public.shop_today(), 'YYYY-MM-DD') || ': $' || returned::text
                      || coalesce(' — ' || nullif(p_note, ''), '')),
         updated_at = now()
   where id = target_sale
  returning * into sale;

  if refund > 0 then
    insert into public.finance_entries
      (entry_date, kind, description, category, amount, method, source, sale_id, created_by)
    values (
      public.shop_today(), 'expense',
      'Return ' || sale.code || ' — ' || sale.customer_name,
      'Refund', refund, coalesce(nullif(p_refund_method, ''), sale.payment_method), 'sale', sale.id, auth.uid()
    );
  end if;

  return sale;
end;
$$;

revoke execute on function public.return_sale_items(uuid, jsonb, text, text) from public, anon;
grant  execute on function public.return_sale_items(uuid, jsonb, text, text) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────
-- 3. ATOMIC STOCK ADJUSTMENT
-- ─────────────────────────────────────────────────────────────
create or replace function public.adjust_stock(
  target_item uuid,
  p_delta integer,
  p_reason text,
  p_note text default null
)
returns public.stock_items
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated public.stock_items;
begin
  if p_delta = 0 then
    raise exception 'Adjustment cannot be zero';
  end if;
  if p_reason not in ('adjustment', 'loss', 'return') then
    raise exception 'Unknown reason %', p_reason;
  end if;

  update public.stock_items
     set stock_in = stock_in + p_delta, updated_at = now()
   where id = target_item
  returning * into updated;
  if not found then
    raise exception 'Stock item % not found', target_item;
  end if;

  insert into public.stock_movements (stock_item_id, delta, reason, unit_cost, reference, created_by)
  values (target_item, p_delta, p_reason, updated.cost, nullif(p_note, ''), auth.uid());

  return updated;
end;
$$;

revoke execute on function public.adjust_stock(uuid, integer, text, text) from public, anon;
grant  execute on function public.adjust_stock(uuid, integer, text, text) to authenticated, service_role;

commit;

notify pgrst, 'reload schema';
