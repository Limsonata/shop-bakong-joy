-- Expanded schema: wishlists, carts, addresses, product_images, inventory_log,
-- tags, coupons, banners, flash_sales, loyalty_points, referrals,
-- shipping_rates, audit_log, faqs

-- ─────────────────────────────────────────────────────────────
-- WISHLISTS
-- ─────────────────────────────────────────────────────────────
create table public.wishlists (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  product_id uuid        not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);
create index wishlists_user_id_idx on public.wishlists (user_id);

alter table public.wishlists enable row level security;

create policy wishlists_owner_read   on public.wishlists for select to authenticated using ((select auth.uid()) = user_id);
create policy wishlists_owner_insert on public.wishlists for insert to authenticated with check ((select auth.uid()) = user_id);
create policy wishlists_owner_delete on public.wishlists for delete to authenticated using ((select auth.uid()) = user_id);

-- ─────────────────────────────────────────────────────────────
-- CARTS + CART_ITEMS
-- ─────────────────────────────────────────────────────────────
create table public.carts (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references auth.users(id) on delete cascade,
  session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint carts_owner_check check (
    (user_id is not null and session_id is null)
    or (user_id is null and session_id is not null)
  )
);
create index carts_user_id_idx    on public.carts (user_id);
create index carts_session_id_idx on public.carts (session_id);

create table public.cart_items (
  id             uuid        primary key default gen_random_uuid(),
  cart_id        uuid        not null references public.carts(id) on delete cascade,
  product_id     uuid        not null references public.products(id) on delete cascade,
  variant_key    text,
  quantity       integer     not null default 1 check (quantity > 0),
  price_snapshot numeric     not null check (price_snapshot >= 0),
  created_at     timestamptz not null default now(),
  unique (cart_id, product_id, variant_key)
);
create index cart_items_cart_id_idx on public.cart_items (cart_id);

alter table public.carts enable row level security;
alter table public.cart_items enable row level security;

create policy carts_owner_all on public.carts for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy cart_items_owner_select on public.cart_items for select to authenticated
  using (exists (select 1 from public.carts where id = cart_id and user_id = (select auth.uid())));
create policy cart_items_owner_insert on public.cart_items for insert to authenticated
  with check (exists (select 1 from public.carts where id = cart_id and user_id = (select auth.uid())));
create policy cart_items_owner_update on public.cart_items for update to authenticated
  using  (exists (select 1 from public.carts where id = cart_id and user_id = (select auth.uid())))
  with check (exists (select 1 from public.carts where id = cart_id and user_id = (select auth.uid())));
create policy cart_items_owner_delete on public.cart_items for delete to authenticated
  using (exists (select 1 from public.carts where id = cart_id and user_id = (select auth.uid())));

-- ─────────────────────────────────────────────────────────────
-- ADDRESSES
-- ─────────────────────────────────────────────────────────────
create table public.addresses (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  name         text        not null,
  phone        text        not null,
  address_line text        not null,
  city         text        not null,
  province     text        not null,
  is_default   boolean     not null default false,
  created_at   timestamptz not null default now()
);
create index addresses_user_id_idx on public.addresses (user_id);

alter table public.addresses enable row level security;

create policy addresses_owner_read   on public.addresses for select to authenticated using ((select auth.uid()) = user_id);
create policy addresses_owner_insert on public.addresses for insert to authenticated with check ((select auth.uid()) = user_id);
create policy addresses_owner_update on public.addresses for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy addresses_owner_delete on public.addresses for delete to authenticated using ((select auth.uid()) = user_id);

-- ─────────────────────────────────────────────────────────────
-- PRODUCT IMAGES
-- ─────────────────────────────────────────────────────────────
create table public.product_images (
  id         uuid        primary key default gen_random_uuid(),
  product_id uuid        not null references public.products(id) on delete cascade,
  url        text        not null,
  alt_text   text,
  position   integer     not null default 0,
  created_at timestamptz not null default now()
);
create index product_images_product_id_idx on public.product_images (product_id, position);

alter table public.product_images enable row level security;

create policy product_images_public_read  on public.product_images for select to anon, authenticated using (true);
create policy product_images_admin_insert on public.product_images for insert to authenticated with check (public.is_admin());
create policy product_images_admin_update on public.product_images for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy product_images_admin_delete on public.product_images for delete to authenticated using (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- INVENTORY LOG
-- ─────────────────────────────────────────────────────────────
create table public.inventory_log (
  id          uuid        primary key default gen_random_uuid(),
  product_id  uuid        not null references public.products(id) on delete cascade,
  variant_key text,
  delta       integer     not null,
  reason      text        not null check (reason in ('sold', 'restock', 'adjustment', 'return')),
  created_by  uuid        references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index inventory_log_product_id_idx on public.inventory_log (product_id);
create index inventory_log_created_at_idx on public.inventory_log (created_at desc);

alter table public.inventory_log enable row level security;

create policy inventory_log_admin_all on public.inventory_log for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- TAGS + PRODUCT_TAGS
-- ─────────────────────────────────────────────────────────────
create table public.tags (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  handle     text        unique not null,
  created_at timestamptz not null default now()
);

create table public.product_tags (
  product_id uuid not null references public.products(id) on delete cascade,
  tag_id     uuid not null references public.tags(id) on delete cascade,
  primary key (product_id, tag_id)
);
create index product_tags_tag_id_idx on public.product_tags (tag_id);

alter table public.tags enable row level security;
alter table public.product_tags enable row level security;

create policy tags_public_read   on public.tags for select to anon, authenticated using (true);
create policy tags_admin_insert  on public.tags for insert to authenticated with check (public.is_admin());
create policy tags_admin_update  on public.tags for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy tags_admin_delete  on public.tags for delete to authenticated using (public.is_admin());

create policy product_tags_public_read  on public.product_tags for select to anon, authenticated using (true);
create policy product_tags_admin_insert on public.product_tags for insert to authenticated with check (public.is_admin());
create policy product_tags_admin_delete on public.product_tags for delete to authenticated using (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- COUPONS
-- ─────────────────────────────────────────────────────────────
create table public.coupons (
  id         uuid        primary key default gen_random_uuid(),
  code       text        unique not null,
  type       text        not null check (type in ('percent', 'fixed')),
  value      numeric     not null check (value > 0),
  min_order  numeric     not null default 0 check (min_order >= 0),
  max_uses   integer,
  uses_count integer     not null default 0,
  active     boolean     not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index coupons_code_idx on public.coupons (lower(code));

alter table public.coupons enable row level security;

create policy coupons_auth_read    on public.coupons for select to authenticated
  using (active = true or public.is_admin());
create policy coupons_admin_insert on public.coupons for insert to authenticated with check (public.is_admin());
create policy coupons_admin_update on public.coupons for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy coupons_admin_delete on public.coupons for delete to authenticated using (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- BANNERS
-- ─────────────────────────────────────────────────────────────
create table public.banners (
  id         uuid        primary key default gen_random_uuid(),
  title      text        not null,
  subtitle   text,
  image_url  text        not null,
  link_url   text,
  position   integer     not null default 0,
  active     boolean     not null default true,
  created_at timestamptz not null default now()
);
create index banners_position_idx on public.banners (position) where active = true;

alter table public.banners enable row level security;

create policy banners_public_read  on public.banners for select to anon, authenticated using (active = true or public.is_admin());
create policy banners_admin_insert on public.banners for insert to authenticated with check (public.is_admin());
create policy banners_admin_update on public.banners for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy banners_admin_delete on public.banners for delete to authenticated using (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- FLASH SALES
-- ─────────────────────────────────────────────────────────────
create table public.flash_sales (
  id         uuid        primary key default gen_random_uuid(),
  product_id uuid        not null references public.products(id) on delete cascade,
  sale_price numeric     not null check (sale_price >= 0),
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index flash_sales_product_id_idx on public.flash_sales (product_id);
create index flash_sales_active_idx     on public.flash_sales (starts_at, ends_at);

alter table public.flash_sales enable row level security;

create policy flash_sales_public_read  on public.flash_sales for select to anon, authenticated
  using (now() between starts_at and ends_at or public.is_admin());
create policy flash_sales_admin_insert on public.flash_sales for insert to authenticated with check (public.is_admin());
create policy flash_sales_admin_update on public.flash_sales for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy flash_sales_admin_delete on public.flash_sales for delete to authenticated using (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- LOYALTY POINTS
-- ─────────────────────────────────────────────────────────────
create table public.loyalty_points (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  order_id   uuid        references public.orders(id) on delete set null,
  points     integer     not null,
  type       text        not null check (type in ('earned', 'redeemed', 'adjusted')),
  note       text,
  created_at timestamptz not null default now()
);
create index loyalty_points_user_id_idx on public.loyalty_points (user_id);

alter table public.loyalty_points enable row level security;

create policy loyalty_owner_read   on public.loyalty_points for select to authenticated
  using ((select auth.uid()) = user_id or public.is_admin());
create policy loyalty_admin_insert on public.loyalty_points for insert to authenticated with check (public.is_admin());
create policy loyalty_admin_update on public.loyalty_points for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy loyalty_admin_delete on public.loyalty_points for delete to authenticated using (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- REFERRALS
-- ─────────────────────────────────────────────────────────────
create table public.referrals (
  id          uuid        primary key default gen_random_uuid(),
  referrer_id uuid        not null references auth.users(id) on delete cascade,
  referred_id uuid        references auth.users(id) on delete set null,
  code        text        unique not null,
  status      text        not null default 'pending' check (status in ('pending', 'converted', 'expired')),
  created_at  timestamptz not null default now()
);
create index referrals_referrer_id_idx on public.referrals (referrer_id);
create index referrals_code_idx        on public.referrals (code);

alter table public.referrals enable row level security;

create policy referrals_owner_read   on public.referrals for select to authenticated
  using ((select auth.uid()) = referrer_id or (select auth.uid()) = referred_id or public.is_admin());
create policy referrals_owner_insert on public.referrals for insert to authenticated
  with check ((select auth.uid()) = referrer_id);
create policy referrals_admin_update on public.referrals for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- SHIPPING RATES
-- ─────────────────────────────────────────────────────────────
create table public.shipping_rates (
  id                      uuid        primary key default gen_random_uuid(),
  zone_name               text        not null,
  province                text        unique not null,
  rate                    numeric     not null check (rate >= 0),
  min_order_free_shipping numeric,
  created_at              timestamptz not null default now()
);
create index shipping_rates_province_idx on public.shipping_rates (province);

alter table public.shipping_rates enable row level security;

create policy shipping_rates_public_read  on public.shipping_rates for select to anon, authenticated using (true);
create policy shipping_rates_admin_insert on public.shipping_rates for insert to authenticated with check (public.is_admin());
create policy shipping_rates_admin_update on public.shipping_rates for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy shipping_rates_admin_delete on public.shipping_rates for delete to authenticated using (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- AUDIT LOG
-- ─────────────────────────────────────────────────────────────
create table public.audit_log (
  id         uuid        primary key default gen_random_uuid(),
  admin_id   uuid        references auth.users(id) on delete set null,
  action     text        not null,
  table_name text        not null,
  record_id  uuid,
  old_data   jsonb,
  new_data   jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_admin_id_idx   on public.audit_log (admin_id);
create index audit_log_created_at_idx on public.audit_log (created_at desc);
create index audit_log_table_idx      on public.audit_log (table_name, record_id);

alter table public.audit_log enable row level security;

-- Immutable log: admins can read and insert, but not update or delete
create policy audit_log_admin_read   on public.audit_log for select to authenticated using (public.is_admin());
create policy audit_log_admin_insert on public.audit_log for insert to authenticated with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- FAQs
-- ─────────────────────────────────────────────────────────────
create table public.faqs (
  id         uuid        primary key default gen_random_uuid(),
  question   text        not null,
  answer     text        not null,
  category   text        not null default 'general',
  position   integer     not null default 0,
  active     boolean     not null default true,
  created_at timestamptz not null default now()
);
create index faqs_active_position_idx on public.faqs (position) where active = true;

alter table public.faqs enable row level security;

create policy faqs_public_read  on public.faqs for select to anon, authenticated using (active = true or public.is_admin());
create policy faqs_admin_insert on public.faqs for insert to authenticated with check (public.is_admin());
create policy faqs_admin_update on public.faqs for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy faqs_admin_delete on public.faqs for delete to authenticated using (public.is_admin());

notify pgrst, 'reload schema';
