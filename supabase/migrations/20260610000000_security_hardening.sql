-- High-security baseline for the ecommerce app.
-- Run in Supabase SQL Editor or through `supabase db push` after review.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  handle text unique not null,
  title text not null,
  description text,
  product_type text,
  price numeric not null check (price >= 0),
  currency text not null default 'USD',
  image_url text,
  in_stock boolean not null default true,
  collections text[] not null default '{}',
  variants jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  handle text unique not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  phone text not null,
  address text not null,
  total numeric not null check (total >= 0),
  currency text not null default 'USD',
  bakong_reference text,
  bakong_transaction_id text,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'shipped', 'done', 'cancelled')),
  items jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  rating integer not null check (rating between 1 and 5),
  text text not null,
  highlight text,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.products add column if not exists variants jsonb;
alter table public.products alter column currency set default 'USD';
alter table public.products alter column in_stock set default true;
alter table public.products alter column collections set default '{}';

alter table public.collections add column if not exists created_at timestamptz not null default now();
alter table public.feedback add column if not exists location text;
alter table public.feedback add column if not exists highlight text;
alter table public.feedback add column if not exists approved boolean not null default false;
alter table public.feedback add column if not exists created_at timestamptz not null default now();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.products enable row level security;
alter table public.collections enable row level security;
alter table public.orders enable row level security;
alter table public.feedback enable row level security;
alter table public.profiles enable row level security;

grant select on table public.products to anon, authenticated;
grant select on table public.collections to anon, authenticated;
grant select, insert on table public.feedback to anon;
grant select, insert, update, delete on table public.products to authenticated;
grant select, insert, update, delete on table public.collections to authenticated;
grant select, insert, update, delete on table public.feedback to authenticated;
grant select, update on table public.orders to authenticated;
grant select, update on table public.profiles to authenticated;

revoke insert, update, delete on table public.products from anon;
revoke insert, update, delete on table public.collections from anon;
revoke insert, update, delete on table public.orders from anon, authenticated;
revoke update, delete on table public.feedback from anon;
revoke insert, delete on table public.profiles from anon, authenticated;

drop policy if exists "Products are viewable by everyone" on public.products;
drop policy if exists "Only admins can insert products" on public.products;
drop policy if exists "Only admins can update products" on public.products;
drop policy if exists "Only admins can delete products" on public.products;
drop policy if exists products_public_read on public.products;
drop policy if exists products_admin_insert on public.products;
drop policy if exists products_admin_update on public.products;
drop policy if exists products_admin_delete on public.products;

create policy products_public_read
  on public.products for select
  to anon, authenticated
  using (true);

create policy products_admin_insert
  on public.products for insert
  to authenticated
  with check (public.is_admin());

create policy products_admin_update
  on public.products for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy products_admin_delete
  on public.products for delete
  to authenticated
  using (public.is_admin());

drop policy if exists collections_public_read on public.collections;
drop policy if exists collections_admin_insert on public.collections;
drop policy if exists collections_admin_update on public.collections;
drop policy if exists collections_admin_delete on public.collections;

create policy collections_public_read
  on public.collections for select
  to anon, authenticated
  using (true);

create policy collections_admin_insert
  on public.collections for insert
  to authenticated
  with check (public.is_admin());

create policy collections_admin_update
  on public.collections for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy collections_admin_delete
  on public.collections for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "Users can view their own orders" on public.orders;
drop policy if exists "Anyone can create orders" on public.orders;
drop policy if exists "Only admins can update orders" on public.orders;
drop policy if exists orders_owner_or_admin_read on public.orders;
drop policy if exists orders_admin_update on public.orders;

create policy orders_owner_or_admin_read
  on public.orders for select
  to authenticated
  using (
    ((select auth.uid()) is not null and user_id = (select auth.uid()))
    or public.is_admin()
  );

create policy orders_admin_update
  on public.orders for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists feedback_public_approved_read on public.feedback;
drop policy if exists feedback_public_insert_pending on public.feedback;
drop policy if exists feedback_admin_read on public.feedback;
drop policy if exists feedback_admin_update on public.feedback;
drop policy if exists feedback_admin_delete on public.feedback;

create policy feedback_public_approved_read
  on public.feedback for select
  to anon, authenticated
  using (approved = true);

create policy feedback_public_insert_pending
  on public.feedback for insert
  to anon, authenticated
  with check (approved = false);

create policy feedback_admin_read
  on public.feedback for select
  to authenticated
  using (public.is_admin());

create policy feedback_admin_update
  on public.feedback for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy feedback_admin_delete
  on public.feedback for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "Users can view their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Admins can view all profiles" on public.profiles;
drop policy if exists profiles_owner_or_admin_read on public.profiles;
drop policy if exists profiles_owner_update_name on public.profiles;
drop policy if exists profiles_admin_update on public.profiles;

create policy profiles_owner_or_admin_read
  on public.profiles for select
  to authenticated
  using (
    ((select auth.uid()) is not null and id = (select auth.uid()))
    or public.is_admin()
  );

create policy profiles_owner_update_name
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) is not null and id = (select auth.uid()))
  with check (
    (select auth.uid()) is not null
    and id = (select auth.uid())
    and role = 'user'
  );

create policy profiles_admin_update
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

notify pgrst, 'reload schema';
