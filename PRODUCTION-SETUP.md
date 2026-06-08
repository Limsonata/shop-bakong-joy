# Production Setup: 30 Minutes to Live

Your code is now **production-ready**. It works as a demo today and automatically becomes a real backend when you add Supabase credentials.

## What's Already Built

✅ **Auth system** - works in demo mode now, switches to Supabase when configured
✅ **Product layer** - reads JSON now, switches to Supabase when configured
✅ **Order system** - saves to localStorage now, switches to Supabase when configured
✅ **Admin orders page** - shows real orders, lets you change status
✅ **Bakong KHQR generator** - generates real, scannable QR codes
✅ **Admin role enforcement** - on every admin page

## To Go Live: 5 Steps

### 1. Create a Supabase Project (3 mins)

1. Go to https://supabase.com and sign up
2. Click "New Project", fill in:
   - Name: `shop-bakong-joy`
   - Database password: (save this somewhere safe)
   - Region: Singapore (closest to Cambodia)
3. Wait ~2 minutes for the project to provision
4. Go to **Project Settings → API** and copy:
   - `Project URL`
   - `anon public` key

### 2. Create the Database Tables (5 mins)

In Supabase, go to **SQL Editor** and paste this entire block, then click "Run":

```sql
-- Products table
create table products (
  id uuid primary key default gen_random_uuid(),
  handle text unique not null,
  title text not null,
  description text,
  product_type text,
  price numeric not null,
  currency text default 'USD',
  image_url text,
  in_stock boolean default true,
  collections text[] default '{}',
  created_at timestamptz default now()
);

-- Orders table
create table orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  phone text not null,
  address text not null,
  total numeric not null,
  currency text default 'USD',
  bakong_reference text,
  bakong_transaction_id text,
  status text default 'pending',
  items jsonb not null,
  created_at timestamptz default now()
);

-- User profiles (extends auth.users with role)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  role text default 'user' check (role in ('user', 'admin')),
  created_at timestamptz default now()
);

-- Auto-create profile when a user signs up
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ===== Row Level Security =====
alter table products enable row level security;
alter table orders enable row level security;
alter table profiles enable row level security;

-- Anyone can read products
create policy "Products are viewable by everyone"
  on products for select using (true);

-- Only admins can modify products
create policy "Only admins can insert products"
  on products for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
create policy "Only admins can update products"
  on products for update using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
create policy "Only admins can delete products"
  on products for delete using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Orders: users see their own, admins see all
create policy "Users can view their own orders"
  on orders for select using (
    auth.uid() = user_id
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
create policy "Anyone can create orders"
  on orders for insert with check (true);
create policy "Only admins can update orders"
  on orders for update using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Profiles: users see their own, admins see all
create policy "Users can view their own profile"
  on profiles for select using (
    auth.uid() = id
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);
```

### 3. Add Environment Variables (2 mins)

Create a `.env` file in your project root (already gitignored):

```env
# Supabase
VITE_SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...your-anon-key

# Bakong (your real merchant info)
VITE_BAKONG_MERCHANT_NAME="Your Shop Name"
VITE_BAKONG_MERCHANT_ACCOUNT="your_id@aclb"
VITE_BAKONG_MERCHANT_CITY="Phnom Penh"
VITE_BAKONG_CURRENCY="USD"
```

Restart the dev server. The login page will stop showing demo accounts - it's now using Supabase Auth.

### 4. Create Your First Admin User (3 mins)

1. Go to your live site (or `localhost:8080`)
2. Click "Login" → "Register" tab
3. Sign up with your real email
4. Back in Supabase, go to **SQL Editor** and run:

```sql
update profiles
set role = 'admin'
where id = (select id from auth.users where email = 'your@email.com');
```

5. Log out and log back in. You'll now have admin access.

### 5. Migrate Your Products (5 mins)

In Supabase **SQL Editor**, run this to import the demo products:

```sql
-- Sample products (edit these for your real catalog)
insert into products (handle, title, description, product_type, price, currency, image_url, collections, in_stock) values
('classic-tee', 'Classic Cotton T-Shirt', 'Premium 100% organic cotton t-shirt.', 'Apparel', 24.99, 'USD',
  'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg',
  array['Apparel', 'Featured'], true),
('leather-wallet', 'Handcrafted Leather Wallet', 'Genuine leather wallet, 8 card slots.', 'Accessories', 49.99, 'USD',
  'https://images.unsplash.com/photo-1627123424574-724758594e93?w=600',
  array['Accessories', 'Featured'], true),
('coffee-mug', 'Ceramic Coffee Mug', '12oz ceramic mug, dishwasher safe.', 'Home', 14.99, 'USD',
  'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600',
  array['Home'], true);
```

Or use the admin panel UI (when you build the product editor) to add them through the website.

---

## Deploy to a Live Domain (10 mins)

### Cloudflare Pages (Recommended - Free)

1. Push your code to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   gh repo create shop-bakong-joy --private --source=. --push
   ```

2. Go to https://dash.cloudflare.com/?to=/:account/pages
3. Click "Create a project" → Connect to GitHub → Select your repo
4. Build settings:
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: `/`
5. Add environment variables (same ones from your `.env`)
6. Deploy

Your site is live at `https://shop-bakong-joy.pages.dev` in 2-3 minutes.

### Custom Domain (Optional - $10/year)

1. Buy a domain at Namecheap, Cloudflare, or Porkbun
2. In Cloudflare Pages → Custom domains → Add domain
3. Update your registrar's DNS to point to Cloudflare
4. SSL certificate is automatic

---

## Real Bakong Merchant Account

For real payments, you need a Bakong merchant account:

1. **Personal account**: Download Bakong app, sign up with phone + Cambodian ID
2. **Business account**: Visit your bank (ABA, ACLEDA, Wing, etc.) and request a merchant Bakong account
3. Update your `.env` with the real account ID
4. Test by scanning the checkout QR with the Bakong app - it should show your real merchant name

For automated payment confirmation (instead of customers entering transaction IDs manually), apply for the Bakong Open API at https://bakong.nbc.gov.kh.

---

## Cost Summary

| Item | Free Tier | When You Outgrow |
|---|---|---|
| Supabase | 500MB DB, 50k MAU | $25/mo at scale |
| Cloudflare Pages | Unlimited bandwidth | Stays free |
| Cloudinary | 25GB images | $89/mo |
| Domain | $10-15/year | Same |
| Bakong | Free for merchants | Free |

**Total**: ~$1/month (just the domain) until you have significant traffic.

---

## What's Different Now

Compare your code before and after — you'll see it's already wired for production:

**`src/lib/auth.ts`** - automatically uses Supabase if `VITE_SUPABASE_URL` is set, otherwise the 2 demo users.

**`src/lib/productStore.ts`** - automatically queries Supabase if configured, otherwise reads `products.json`.

**`src/lib/orderStore.ts`** - automatically saves orders to Supabase if configured, otherwise to localStorage.

**`src/routes/admin/orders.tsx`** - the admin orders page works with both. Try it: place a test order in demo mode and the admin page shows it.

This means **you don't need to change any code** to go live. Just add the env vars and your site becomes a real production app.

---

## Test Locally Before Deploying

After adding `.env` with Supabase credentials, restart the dev server and try:

1. **Register**: Create a real account with your email
2. **Login**: Sign in with that account
3. **Place an order**: Go through checkout (use any made-up Bakong transaction ID for testing)
4. **Become admin**: Run the SQL in step 4 above
5. **Check `/admin/orders`**: Your test order should be there
6. **Update status**: Change it from `pending` to `paid` - it should persist on refresh

If all that works locally, you're 100% ready to deploy.
