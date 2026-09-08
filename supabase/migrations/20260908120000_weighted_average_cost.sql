-- ─────────────────────────────────────────────────────────────
-- WEIGHTED AVERAGE COST for restocks
-- ─────────────────────────────────────────────────────────────
-- The same product is often bought from different stores at
-- different prices. The previous version of record_restock
-- OVERWROTE stock_items.cost with the newest purchase price,
-- so e.g. 10 units left @ $5 + 5 new units @ $8 made all 15
-- units count as $8 — inflating stock value and COGS.
--
-- Fix: keep a moving WEIGHTED AVERAGE cost:
--   avg = (units_left * old_avg + qty * purchase_price) / (units_left + qty)
-- The stock movement still records the ACTUAL price paid for
-- that batch, and the Inventory expense posts the actual cash
-- spent, so the audit trail and cash book stay exact.

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
      current_date, 'expense',
      'Restock ' || quantity || ' x ' || updated.name ||
        coalesce(' (' || supplier || ')', ''),
      'Inventory', round(v_purchase_cost * quantity, 2), 'cash', 'manual', auth.uid()
    );
  end if;

  return updated;
end;
$$;