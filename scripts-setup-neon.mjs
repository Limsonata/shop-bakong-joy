import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);

await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;

await sql`
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
)`;

await sql`
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  price numeric NOT NULL,
  image_url text,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  stock int NOT NULL DEFAULT 0,
  rating numeric NOT NULL DEFAULT 4.5,
  is_featured boolean NOT NULL DEFAULT false,
  is_best_seller boolean NOT NULL DEFAULT false,
  is_new boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)`;

await sql`
CREATE TABLE IF NOT EXISTS profiles (
  id text PRIMARY KEY,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)`;

await sql`
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','user')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
)`;

await sql`
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  order_number text NOT NULL DEFAULT ('ORD-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  status text NOT NULL DEFAULT 'pending',
  payment_status text NOT NULL DEFAULT 'pending',
  payment_reference text,
  subtotal numeric NOT NULL,
  total numeric NOT NULL,
  full_name text NOT NULL,
  phone text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)`;

await sql`
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  product_image text,
  quantity int NOT NULL,
  unit_price numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
)`;

await sql`CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id)`;
await sql`CREATE INDEX IF NOT EXISTS idx_products_cat ON products(category_id)`;

// Seed categories
const cats = [
  ['electronics','Electronics','Gadgets & tech','https://images.unsplash.com/photo-1518770660439-4636190af475?w=800'],
  ['fashion','Fashion','Apparel & style','https://images.unsplash.com/photo-1445205170230-053b83016050?w=800'],
  ['beauty','Beauty','Skincare & cosmetics','https://images.unsplash.com/photo-1522335789203-aaaa8b5b7d29?w=800'],
  ['books','Books','Reads for everyone','https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800'],
  ['home-living','Home & Living','Decor & essentials','https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800'],
  ['sports','Sports','Gear & fitness','https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800'],
];
for (const [slug,name,desc,img] of cats) {
  await sql`INSERT INTO categories (slug,name,description,image_url) VALUES (${slug},${name},${desc},${img}) ON CONFLICT (slug) DO NOTHING`;
}

// Seed a handful of products per category
const catRows = await sql`SELECT id, slug FROM categories`;
const idBy = Object.fromEntries(catRows.map(r => [r.slug, r.id]));

const products = [
  ['wireless-earbuds','Wireless Earbuds Pro','Crisp sound, all-day battery',79,'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?w=600','electronics',true,true,false],
  ['smart-watch','Smart Watch X','Track everything','199','https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600','electronics',true,false,true],
  ['wireless-keyboard','Mechanical Keyboard','Tactile clicky keys',129,'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600','electronics',false,true,false],
  ['leather-jacket','Leather Jacket','Classic biker style',249,'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600','fashion',true,false,false],
  ['denim-jeans','Slim Denim Jeans','Everyday comfort',59,'https://images.unsplash.com/photo-1542272604-787c3835535d?w=600','fashion',false,true,false],
  ['silk-scarf','Silk Scarf','Hand-printed luxury',39,'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=600','fashion',false,false,true],
  ['vitamin-c-serum','Vitamin C Serum','Glow boost',29,'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=600','beauty',true,true,false],
  ['matte-lipstick','Matte Lipstick','Long-lasting color',19,'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=600','beauty',false,false,true],
  ['atomic-habits','Atomic Habits','Build better routines',18,'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600','books',true,true,false],
  ['the-pragmatic-programmer','Pragmatic Programmer','Code with craft',34,'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=600','books',false,false,false],
  ['ceramic-vase','Ceramic Vase','Modern minimal',45,'https://images.unsplash.com/photo-1602874801006-89e1162e7d6f?w=600','home-living',true,false,true],
  ['linen-throw','Linen Throw Blanket','Soft & breathable',69,'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=600','home-living',false,true,false],
  ['yoga-mat','Pro Yoga Mat','Grip & cushion',49,'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=600','sports',true,false,false],
  ['running-shoes','Running Shoes','Lightweight cushion',119,'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600','sports',false,true,true],
];
for (const [slug,name,desc,price,img,catSlug,feat,best,isNew] of products) {
  await sql`INSERT INTO products (slug,name,description,price,image_url,category_id,is_featured,is_best_seller,is_new,stock)
            VALUES (${slug},${name},${desc},${price},${img},${idBy[catSlug]},${feat},${best},${isNew},50)
            ON CONFLICT (slug) DO NOTHING`;
}

console.log('Neon schema ready.');
const c = await sql`SELECT count(*)::int as n FROM products`;
console.log('Products:', c[0].n);
