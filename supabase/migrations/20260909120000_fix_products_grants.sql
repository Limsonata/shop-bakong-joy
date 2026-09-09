-- Fixes "permission denied for table products" (Postgres 42501).
-- Re-applies the grants and the public read policy from
-- 20260610000000_security_hardening.sql in case they were lost
-- (e.g. the table was recreated after the hardening migration ran).
-- Safe to run multiple times.

-- Storefront (anon) and logged-in users (authenticated) must be able to READ products.
grant select on table public.products to anon, authenticated;
grant select on table public.collections to anon, authenticated;
grant select on table public.product_images to anon, authenticated;

-- Writing products stays admin-only and goes through the secure edge
-- functions (service role), so the anon role must never have write grants.
revoke insert, update, delete on table public.products from anon;
revoke insert, update, delete on table public.collections from anon;

-- Row Level Security read policy for products.
drop policy if exists products_public_read on public.products;
create policy products_public_read
  on public.products for select
  to anon, authenticated
  using (true);
