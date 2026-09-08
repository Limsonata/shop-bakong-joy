-- ─────────────────────────────────────────────────────────────
-- PRODUCT ↔ STOCK LINK TWEAKS
-- ─────────────────────────────────────────────────────────────
-- 1. The stock→product sync trigger used to overwrite the shop owner's
--    description and collections every time a stock row changed. Products
--    created/edited on the website (Products page) now auto-create linked
--    stock rows (server side), so those owner-entered fields must survive
--    the trigger's group re-sync. Title / type / price / in_stock / variants
--    are still owned by the stock rows.
-- 2. Index on stock_items.product_id for the order→stock matching lookups.

create index if not exists stock_items_product_id_idx
  on public.stock_items (product_id);

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
    product_type = excluded.product_type,
    price = excluded.price,
    in_stock = excluded.in_stock,
    variants = excluded.variants;
    -- description and collections deliberately not touched: the owner edits
    -- those on the website and the trigger must not reset them.

  update public.stock_items
  set product_id = (select id from public.products where handle = v_handle)
  where name = p_name and category = p_category
    and product_id is distinct from (select id from public.products where handle = v_handle);
end;
$$;

revoke execute on function public.sync_product_from_stock_group(text, text) from public, anon, authenticated;

notify pgrst, 'reload schema';