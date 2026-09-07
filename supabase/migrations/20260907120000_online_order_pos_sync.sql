-- ─────────────────────────────────────────────────────────────
-- ONLINE ORDER → POS SYNC
-- ─────────────────────────────────────────────────────────────
-- When an admin marks a website order as paid/done, the app calls
-- record_online_sale, which records a matching POS sale (channel
-- 'online'), deducts stock and posts the received cash to the
-- ledger — exactly like a sale recorded by hand in the POS — and
-- links it to the website order via sales.order_id.
--
-- Idempotent: if the order already has a linked sale, the existing
-- sale is returned untouched (so changing paid → done does not
-- create a duplicate).
--
-- Cancelling an order that already has a sale is handled by the app
-- calling the existing public.cancel_sale, which restocks the items
-- and posts a refund to the ledger.

create or replace function public.record_online_sale(payload jsonb)
returns public.sales
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order_id uuid;
  v_existing public.sales;
  new_sale   public.sales;
begin
  v_order_id := nullif(payload->>'orderId', '')::uuid;

  if v_order_id is not null then
    select * into v_existing
      from public.sales
     where order_id = v_order_id
     limit 1;
    if found then
      return v_existing;
    end if;
  end if;

  new_sale := public.record_sale(payload);

  if v_order_id is not null then
    update public.sales
       set order_id = v_order_id, updated_at = now()
     where id = new_sale.id
     returning * into new_sale;
  end if;

  return new_sale;
end;
$$;
