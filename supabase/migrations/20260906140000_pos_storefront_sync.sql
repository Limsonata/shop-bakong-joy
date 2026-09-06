-- ─────────────────────────────────────────────────────────────
-- POS → STOREFRONT AUTO-SYNC
-- ─────────────────────────────────────────────────────────────
-- Keeps public.products in sync with public.stock_items automatically.
-- Whenever a stock_items row is inserted, updated, or deleted, the
-- (name, category) group it belongs to is recomputed and upserted into
-- products: title, price (lowest active price in the group), in_stock,
-- and variants (one per stock_items row: size/color/qty/availability).
--
-- image_url is intentionally left alone on update (the shop owner uploads
-- photos by hand in /admin/products), so this trigger never overwrites it.
--
-- Deleting a stock_items row does NOT delete the product — if it was the
-- last item in its group, the product is instead marked out of stock with
-- an empty variant list, so past orders / links to it don't 404.
--
-- Products created by hand (not linked to any stock_items row) are never
-- touched by this trigger.

begin;

create or replace function public.sync_product_from_stock_group(p_name text, p_category text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_handle text;
  v_price numeric;
  v_product_type text;
  v_collections text[];
  v_variants jsonb;
  v_in_stock boolean;
  v_row_count integer;
begin
  select
    count(*),
    min(price) filter (where archived = false),
    bool_or((stock_in - sold) > 0 and archived = false),
    jsonb_agg(
      jsonb_build_object(
        'id', sku,
        'title', trim(concat_ws(' / ', nullif(size, ''), nullif(color, ''))),
        'price', price,
        'availableForSale', (stock_in - sold) > 0 and archived = false,
        'selectedOptions', (
          select jsonb_agg(opt) from (
            select jsonb_build_object('name', 'Size', 'value', size) as opt where size is not null and size <> ''
            union all
            select jsonb_build_object('name', 'Color', 'value', color) where color is not null and color <> ''
          ) opts
        )
      )
      order by sku
    )
  into v_row_count, v_price, v_in_stock, v_variants
  from public.stock_items
  where name = p_name and category = p_category and archived = false;

  v_handle := lower(regexp_replace(p_name || '-' || p_category, '[^a-zA-Z0-9]+', '-', 'g'));
  v_handle := trim(v_handle, '-');
  v_handle := substring(v_handle from 1 for 80);

  v_product_type := case p_category
    when 'Bra & Lingerie' then 'Lingerie'
    when 'Underwear' then 'Underwear'
    when 'Jeans' then 'Bottoms'
    when 'Other' then 'Apparel'
    else p_category
  end;

  v_collections := array['Women'];
  if p_category = 'Bra & Lingerie' then
    v_collections := array['Women', 'Lingerie'];
  end if;

  if v_row_count is null or v_row_count = 0 then
    -- Every item in this group was archived or deleted: keep the product
    -- (so old links/orders still resolve) but mark it unavailable.
    update public.products
    set in_stock = false, variants = '[]'::jsonb
    where handle = v_handle;
    return;
  end if;

  insert into public.products (handle, title, description, product_type, price, currency, in_stock, collections, variants)
  values (
    v_handle,
    p_name,
    p_name || ' — ' || p_category || '. Available in ' || v_row_count || ' size/color combination' || (case when v_row_count = 1 then '' else 's' end) || '.',
    v_product_type,
    coalesce(v_price, 0),
    'USD',
    coalesce(v_in_stock, false),
    v_collections,
    v_variants
  )
  on conflict (handle) do update set
    title = excluded.title,
    description = excluded.description,
    product_type = excluded.product_type,
    price = excluded.price,
    in_stock = excluded.in_stock,
    collections = excluded.collections,
    variants = excluded.variants;
    -- image_url deliberately not touched here.

  update public.stock_items
  set product_id = (select id from public.products where handle = v_handle)
  where name = p_name and category = p_category
    and product_id is distinct from (select id from public.products where handle = v_handle);
end;
$$;

revoke execute on function public.sync_product_from_stock_group(text, text) from public, anon, authenticated;

create or replace function public.stock_items_sync_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Guard against recursion: this trigger's own sync function updates
  -- stock_items.product_id, which would otherwise re-fire this same
  -- trigger forever. pg_trigger_depth() > 1 means we're already inside
  -- a trigger-caused update, so skip re-syncing in that case.
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    perform public.sync_product_from_stock_group(old.name, old.category);
    return old;
  end if;

  perform public.sync_product_from_stock_group(new.name, new.category);

  -- Name or category changed: also resync the group it left behind,
  -- otherwise that product would keep showing the row that just moved out.
  if tg_op = 'UPDATE' and (old.name <> new.name or old.category <> new.category) then
    perform public.sync_product_from_stock_group(old.name, old.category);
  end if;

  return new;
end;
$$;

drop trigger if exists stock_items_sync on public.stock_items;
create trigger stock_items_sync
  after insert or update or delete on public.stock_items
  for each row execute function public.stock_items_sync_trigger();

commit;

notify pgrst, 'reload schema';
