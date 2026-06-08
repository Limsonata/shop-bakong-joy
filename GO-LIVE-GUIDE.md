# Going Live: From Demo to Real Website

This guide takes you from local demo to a real, production website.

## What You Have Now (Demo Mode)

| Feature | Current State | Production Need |
|---|---|---|
| Products | Hardcoded JSON file | Database (Supabase / Sanity) |
| Cart | Browser localStorage | OK as-is, or DB for logged-in users |
| Auth | 2 hardcoded demo users | Real auth (Supabase Auth / Clerk) |
| Admin panel | Changes don't save | Connected to real DB |
| Images | Cloudinary URLs in JSON | Cloudinary (already production-ready) |
| Bakong QR | Real KHQR generated | Need real Bakong merchant account |
| Orders | Not stored anywhere | Database table + admin view |
| Hosting | localhost | Real domain + hosting |

---

## Step-by-Step Production Path

### Step 1: Pick a Backend (Pick ONE)

#### Option A: Supabase (Recommended - Easiest)
**Free tier**: 500MB database, 50k monthly active users, 1GB file storage
- Postgres database
- Built-in auth (email, Google, etc.)
- File storage
- Real-time subscriptions
- Auto-generated REST + GraphQL APIs

```bash
npm install @supabase/supabase-js
```

**Setup**:
1. Create account at https://supabase.com
2. Create new project (takes 2 mins)
3. Copy `URL` and `anon key` from project settings
4. Add to `.env`:
   ```
   VITE_SUPABASE_URL=https://xxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJxxx...
   ```

**Tables to create** (in Supabase SQL editor):
```sql
-- Products
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
  created_at timestamptz default now()
);

-- Orders
create table orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  customer_name text not null,
  phone text not null,
  address text not null,
  total numeric not null,
  currency text default 'USD',
  bakong_reference text,
  bakong_transaction_id text,
  status text default 'pending', -- pending | paid | shipped | done
  items jsonb not null,
  created_at timestamptz default now()
);

-- Profiles (extends auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  role text default 'user', -- user | admin
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create function handle_new_user() returns trigger as $$
begin
  insert into profiles (id, name) values (new.id, new.raw_user_meta_data->>'name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```

#### Option B: Sanity.io (Best for content-heavy sites)
**Free tier**: 3 users, 10k documents, 100k API CDN requests
- Headless CMS with great admin UI
- Real-time collaboration
- Image transformations built-in
- Need separate auth (Clerk, Auth0)

#### Option C: Firebase
**Free tier**: 1GB storage, 50k reads/day
- Google's offering, easy auth
- Firestore NoSQL database

---

### Step 2: Replace Demo Auth with Real Auth

Currently `src/lib/auth.ts` has hardcoded users. Replace with Supabase Auth:

```typescript
// src/lib/auth.ts (production version)
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

export async function login(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { success: false, error: error.message };
  return { success: true, user: data.user };
}

export async function register(email: string, password: string, name: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error) return { success: false, error: error.message };
  return { success: true, user: data.user };
}

export async function logout() {
  await supabase.auth.signOut();
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return { ...user, ...profile };
}
```

**Make a user admin**: In Supabase SQL editor:
```sql
update profiles set role = 'admin' where id = (
  select id from auth.users where email = 'you@example.com'
);
```

---

### Step 3: Move Products from JSON to Database

Replace `src/data/products.json` reads in `src/lib/localStore.ts` with Supabase queries:

```typescript
export async function getProducts(options = {}) {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .limit(options.first || 50);
  if (error) throw error;
  return data;
}

export async function getProductByHandle(handle: string) {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("handle", handle)
    .single();
  if (error) throw error;
  return data;
}
```

Then make the admin panel actually save changes:
```typescript
// In src/routes/admin/products.tsx
async function handleAdd(product) {
  const { error } = await supabase.from("products").insert(product);
  if (!error) toast.success("Product added");
}
```

---

### Step 4: Save Orders to Database

In `src/routes/checkout/bakong.tsx`, replace the demo `setIsSubmitted(true)` with:

```typescript
const handleSubmit = async (event) => {
  event.preventDefault();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  const { error } = await supabase.from("orders").insert({
    user_id: user?.id,
    customer_name: formData.name,
    phone: formData.phone,
    address: formData.address,
    total: totals.total,
    currency: totals.currency,
    bakong_reference: paymentReference,
    bakong_transaction_id: formData.transactionId,
    items: items, // jsonb column
  });

  if (error) {
    toast.error("Failed to submit order");
    return;
  }
  
  setIsSubmitted(true);
  clearCart();
};
```

---

### Step 5: Set Up Real Bakong Merchant

1. **Get a Bakong account**:
   - Download Bakong app (Cambodia)
   - Sign up with phone + Cambodian ID
   - For business: register as merchant via your bank (ABA, ACLEDA, etc.)

2. **Configure your env vars**:
   ```env
   VITE_BAKONG_MERCHANT_NAME="Your Real Shop Name"
   VITE_BAKONG_MERCHANT_ACCOUNT="your_real_id@aclb"  # from your bank
   VITE_BAKONG_MERCHANT_CITY="Phnom Penh"
   VITE_BAKONG_CURRENCY="USD"
   ```

3. **Test the QR**: Open the app, point your phone's Bakong app at it - you should see your real merchant info.

4. **For automatic payment verification** (advanced):
   - Apply for Bakong Open API access at https://bakong.nbc.gov.kh
   - Use their webhook to confirm payments instead of manual transaction ID entry

---

### Step 6: Deploy to a Real Host

This project uses TanStack Start (SSR), so you need a host that supports Node.js or edge functions.

#### Option A: Cloudflare Pages (Free, Recommended)
The project is already set up for Cloudflare via Nitro.

```bash
npm install -g wrangler
npm run build
wrangler pages deploy dist
```

Or connect your Git repo at https://dash.cloudflare.com/pages and it auto-deploys.

#### Option B: Vercel
```bash
npm install -g vercel
vercel
```

#### Option C: Netlify
```bash
npm install -g netlify-cli
netlify deploy --prod
```

**Add environment variables** in your hosting dashboard (Cloudflare/Vercel/Netlify):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_BAKONG_MERCHANT_NAME`
- `VITE_BAKONG_MERCHANT_ACCOUNT`
- `VITE_BAKONG_MERCHANT_CITY`
- `VITE_CLOUDINARY_CLOUD_NAME` (if using Cloudinary)

---

### Step 7: Get a Domain

1. **Buy a domain** ($10-15/year):
   - Namecheap, Cloudflare, Porkbun, GoDaddy
   - Pick something memorable: `yourshop.com`, `yourshop.kh`, etc.

2. **Connect to your host**:
   - In your hosting dashboard, add the domain
   - Update DNS at your registrar to point to the host
   - SSL certificate is automatic on Cloudflare/Vercel/Netlify

---

### Step 8: Production Checklist

**Security**:
- [ ] Never commit `.env` files (already in `.gitignore`)
- [ ] Use Supabase Row Level Security (RLS) policies
- [ ] Only use `anon` keys on the client, never `service_role`
- [ ] Validate all forms server-side too

**Performance**:
- [ ] Optimize images via Cloudinary transformations
- [ ] Enable Cloudflare CDN caching
- [ ] Run `npm run build` and check the output size

**Legal**:
- [ ] Add Terms of Service page
- [ ] Add Privacy Policy page
- [ ] If selling in EU - GDPR compliance
- [ ] If in Cambodia - register your business

**Analytics & Monitoring**:
- [ ] Add Plausible or Google Analytics
- [ ] Set up Sentry for error tracking (free tier)
- [ ] Monitor Bakong payments daily until automated

---

## Cost Summary (Monthly)

| Item | Free Tier | If You Outgrow It |
|---|---|---|
| Supabase | $0 (500MB DB, 50k users) | $25/mo |
| Cloudflare Pages | $0 (unlimited) | Stays free |
| Cloudinary | $0 (25GB storage) | $89/mo |
| Domain | $10-15/year | Same |
| Bakong | $0 | $0 (free for merchants) |
| **Total** | **~$1/month** (just domain) | ~$30/month at scale |

---

## Recommended Order of Work

1. **Week 1**: Set up Supabase, migrate products from JSON to DB
2. **Week 2**: Replace demo auth with Supabase Auth, add real admin role
3. **Week 3**: Hook up admin panel to actually save changes
4. **Week 4**: Save orders to DB, build admin orders view
5. **Week 5**: Deploy to Cloudflare Pages, buy domain
6. **Week 6**: Get real Bakong merchant account, test live payments
7. **Week 7**: Add ToS, Privacy Policy, analytics
8. **Launch!** 🚀

---

## Need Help With a Specific Step?

Just ask! For example:
- "Set up Supabase and migrate products"
- "Build a real signup/login with Supabase Auth"
- "Make admin panel save to database"
- "Deploy to Cloudflare Pages"
- "Add an orders admin view"
