# Supabase Setup Walkthrough (15 minutes)

Follow these exact steps. I'll be ready to help if anything fails.

## Step 1: Create Account & Project (3 min)

1. Open https://supabase.com/dashboard/sign-up in a new tab
2. Sign up with GitHub or email
3. Once signed in, click **"New Project"**
4. Fill in:
   - **Organization**: Pick the one created automatically
   - **Project name**: `shop-bakong-joy`
   - **Database Password**: Click "Generate" and **copy this somewhere safe**
   - **Region**: `Southeast Asia (Singapore)` (closest to Cambodia)
   - **Pricing Plan**: Free
5. Click **"Create new project"**
6. Wait ~2 minutes for it to provision

## Step 2: Get Your API Keys (1 min)

Once the project is ready:

1. In the left sidebar, click the **gear icon** (Settings) at the bottom
2. Click **"API"**
3. You'll see two values you need:
   - **Project URL** → looks like `https://abcdefgh.supabase.co`
   - **Project API keys** → copy the `anon` `public` one (the long `eyJ...` string)

Keep this tab open, you'll come back for the SQL Editor.

## Step 3: Add Credentials to Your Project (1 min)

In your project, create a `.env` file at the root:

**Tell me the values and I'll create the file for you, OR create it manually:**

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...your-very-long-key-here

# Your Bakong info (or leave the defaults for now)
VITE_BAKONG_MERCHANT_NAME="Shop Bakong Joy"
VITE_BAKONG_MERCHANT_ACCOUNT="mengsry_mey@bkrt"
VITE_BAKONG_MERCHANT_CITY="Phnom Penh"
VITE_BAKONG_CURRENCY="USD"
```

After creating `.env`, **restart the dev server**:
```bash
# Press Ctrl+C in the terminal running `npm run dev`
npm run dev
```

## Step 4: Create the Database Tables (3 min)

Back in Supabase:

1. In the left sidebar, click the **lightning bolt icon** (SQL Editor)
2. Click **"New query"**
3. Copy and paste this entire SQL block:

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
  status text default 'pending' check (status in ('pending','paid','shipped','done','cancelled')),
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Enable Row Level Security
alter table products enable row level security;
alter table orders enable row level security;
alter table profiles enable row level security;

-- Products: public read, admin write
create policy "Products are viewable by everyone"
  on products for select using (true);
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

-- Helpful: allow admins to view all profiles for the admin user list
create policy "Admins can view all profiles"
  on profiles for select using (
    exists (select 1 from profiles p2 where p2.id = auth.uid() and p2.role = 'admin')
  );
```

4. Click **"Run"** (bottom right) - you should see "Success. No rows returned"

## Step 5: Sign Up Your First User & Make Yourself Admin (3 min)

Since email confirmation is enabled by default and that creates friction, let's disable it for now:

1. In Supabase, go to **Authentication** (left sidebar) → **Providers** → **Email**
2. Toggle off **"Confirm email"**
3. Click **"Save"**

Now create your account on your site:

1. Go to `http://localhost:8080/admin/login`
2. Click the **"Register"** tab
3. Fill in your real email, name, and a password (6+ chars)
4. Click **"Create Account"**
5. You should be logged in

Make yourself admin in Supabase:

1. Back in Supabase, click **SQL Editor** → **New query**
2. Run:
   ```sql
   update profiles
   set role = 'admin'
   where id = (select id from auth.users where email = 'YOUR-EMAIL@example.com');
   ```
   (Replace YOUR-EMAIL with the email you just signed up with)

3. On your site, log out and log back in
4. Now go to `/admin` - you should have full access

## Step 6: Add Some Products (3 min)

You can now use the **product editor UI** I just built:

1. Go to `/admin/products`
2. Click **"Add Product"**
3. Fill in the form (title, price, image URL, etc.)
4. Click **"Create product"**
5. Refresh the storefront - your new product is live

Or seed the demo products via SQL:

```sql
insert into products (handle, title, description, product_type, price, currency, image_url, collections, in_stock) values
('classic-tee', 'Classic Cotton T-Shirt', 'Premium 100% organic cotton.', 'Apparel', 24.99, 'USD',
  'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600',
  array['Apparel', 'Featured'], true),
('leather-wallet', 'Handcrafted Leather Wallet', 'Genuine leather, 8 card slots.', 'Accessories', 49.99, 'USD',
  'https://images.unsplash.com/photo-1627123424574-724758594e93?w=600',
  array['Accessories', 'Featured'], true),
('coffee-mug', 'Ceramic Coffee Mug', '12oz ceramic mug, dishwasher safe.', 'Home', 14.99, 'USD',
  'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600',
  array['Home'], true);
```

## Done!

You now have:
- ✅ Real user accounts
- ✅ Real product database
- ✅ Real order persistence
- ✅ Admin role with proper permissions
- ✅ Row-level security so users can't see each other's data

## What If Something Breaks?

**"Invalid email or password"** when logging in
- Check that **Confirm email** is OFF in Supabase Auth settings
- Try registering again

**"new row violates row-level security policy"** when creating products
- Make sure you ran the admin role UPDATE SQL
- Log out and back in to refresh your session

**Login form spinning forever**
- Open the browser console (F12) and check for errors
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set correctly in `.env`
- Make sure you restarted the dev server after creating `.env`

Just paste any error you see and I'll help fix it.
