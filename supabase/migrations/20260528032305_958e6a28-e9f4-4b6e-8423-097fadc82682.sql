
-- Roles
create type public.app_role as enum ('admin','user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null default 'user',
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "user_roles self read" on public.user_roles for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles self read" on public.profiles for select to authenticated using (auth.uid() = id or public.has_role(auth.uid(),'admin'));
create policy "profiles self insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles self update" on public.profiles for update to authenticated using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Categories
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  created_at timestamptz not null default now()
);
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "categories public read" on public.categories for select using (true);
create policy "categories admin write" on public.categories for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Products
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  price numeric(10,2) not null check (price >= 0),
  image_url text,
  category_id uuid references public.categories(id) on delete set null,
  stock integer not null default 0,
  rating numeric(2,1) not null default 4.5,
  is_featured boolean not null default false,
  is_best_seller boolean not null default false,
  is_new boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "products public read" on public.products for select using (true);
create policy "products admin write" on public.products for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Orders
create type public.order_status as enum ('pending','confirmed','shipped','delivered','cancelled');
create type public.payment_status as enum ('pending','paid','failed');

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_number text not null unique default 'ORD-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  status order_status not null default 'pending',
  payment_status payment_status not null default 'pending',
  subtotal numeric(10,2) not null,
  total numeric(10,2) not null,
  full_name text not null,
  phone text not null,
  address text not null,
  city text not null,
  notes text,
  lat numeric(10,7),
  lng numeric(10,7),
  payment_proof_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "orders self read" on public.orders for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
create policy "orders self insert" on public.orders for insert to authenticated with check (auth.uid() = user_id);
create policy "orders self update payment proof" on public.orders for update to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  product_image text,
  unit_price numeric(10,2) not null,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);
grant select, insert on public.order_items to authenticated;
grant all on public.order_items to service_role;
alter table public.order_items enable row level security;
create policy "order_items via order" on public.order_items for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.has_role(auth.uid(),'admin')))
);
create policy "order_items insert via order" on public.order_items for insert to authenticated with check (
  exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
);

-- Storage buckets
insert into storage.buckets (id, name, public) values ('product-images','product-images', true) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('payment-proofs','payment-proofs', false) on conflict do nothing;

create policy "product-images public read" on storage.objects for select using (bucket_id = 'product-images');
create policy "product-images admin write" on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and public.has_role(auth.uid(),'admin'));
create policy "product-images admin update" on storage.objects for update to authenticated using (bucket_id = 'product-images' and public.has_role(auth.uid(),'admin'));
create policy "product-images admin delete" on storage.objects for delete to authenticated using (bucket_id = 'product-images' and public.has_role(auth.uid(),'admin'));

create policy "payment-proofs user upload" on storage.objects for insert to authenticated with check (bucket_id = 'payment-proofs' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "payment-proofs user read" on storage.objects for select to authenticated using (bucket_id = 'payment-proofs' and (auth.uid()::text = (storage.foldername(name))[1] or public.has_role(auth.uid(),'admin')));

-- Seed categories and products
insert into public.categories (name, slug, description, image_url) values
  ('Electronics','electronics','Phones, laptops and gadgets','https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800'),
  ('Fashion','fashion','Apparel and accessories','https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800'),
  ('Home & Living','home','Decor and essentials','https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=800'),
  ('Beauty','beauty','Skincare and makeup','https://images.unsplash.com/photo-1522335789203-aaa2e80f48d3?w=800'),
  ('Sports','sports','Gear and outdoor','https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800'),
  ('Books','books','Bestsellers and classics','https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800');

with c as (select id, slug from public.categories)
insert into public.products (name, slug, description, price, image_url, category_id, stock, rating, is_featured, is_best_seller, is_new) values
  ('Wireless Headphones','wireless-headphones','Premium over-ear with ANC',129.00,'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800',(select id from c where slug='electronics'),50,4.8,true,true,false),
  ('Smart Watch Pro','smart-watch-pro','Track health and notifications',249.00,'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800',(select id from c where slug='electronics'),30,4.7,true,false,true),
  ('4K Action Camera','action-camera','Capture every adventure',199.00,'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800',(select id from c where slug='electronics'),20,4.6,false,true,false),
  ('Minimal Sneakers','minimal-sneakers','Everyday comfort',89.00,'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800',(select id from c where slug='fashion'),100,4.5,true,true,false),
  ('Linen Shirt','linen-shirt','Breathable summer fit',49.00,'https://images.unsplash.com/photo-1602810316693-3667c854239a?w=800',(select id from c where slug='fashion'),80,4.4,false,false,true),
  ('Leather Backpack','leather-backpack','Handmade premium leather',159.00,'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800',(select id from c where slug='fashion'),25,4.9,true,true,false),
  ('Ceramic Vase','ceramic-vase','Hand-thrown matte finish',39.00,'https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=800',(select id from c where slug='home'),60,4.3,false,false,true),
  ('Linen Throw Blanket','linen-throw','Soft and breathable',69.00,'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=800',(select id from c where slug='home'),40,4.6,true,false,false),
  ('Vitamin C Serum','vitamin-c-serum','Brighten and even tone',35.00,'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800',(select id from c where slug='beauty'),120,4.7,false,true,false),
  ('Yoga Mat','yoga-mat','Non-slip eco material',45.00,'https://images.unsplash.com/photo-1599447421416-3414500d18a5?w=800',(select id from c where slug='sports'),90,4.5,true,false,true),
  ('Running Shoes','running-shoes','Lightweight and responsive',119.00,'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800',(select id from c where slug='sports'),70,4.6,false,true,false),
  ('Bestseller Novel','bestseller-novel','Critically acclaimed fiction',19.00,'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800',(select id from c where slug='books'),200,4.8,false,true,false);
