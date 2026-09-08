# BillieGrace Closet (Shop Bakong Joy) — E-commerce Store

A modern e-commerce storefront **plus a complete back-office** for a small shop in Cambodia, built with React and TanStack Start. Products, orders, sales and money records are stored in **Supabase** (with a localStorage fallback so the admin tools work offline).

## ✨ Features

### Customer storefront
- 🛍️ Browse products, search & filter by collection, product type and price
- 🛒 Persistent cart (localStorage via Zustand — single source of truth)
- 📍 Checkout with map-based delivery location picker (Google Maps)
- 💵 Pay on delivery (cash when we arrive)
- 📦 Order tracking at `/track` (order reference or order ID)
- 👤 Customer accounts via Telegram or email/password
- 🔔 Telegram + in-app notifications for order updates

### Admin back-office (`/admin`)
- **Dashboard** — today's sales, online orders, low stock, revenue chart
- **New sale (POS)** — record in-store sales with payment tracking
- **Orders (online)** — website orders with realtime updates + status changes
- **Products / Categories** — manage the public website catalog (Supabase)
- **Stock (inventory)** — POS inventory: SKU, size, color, cost, stock-in, low-stock alerts
- **Sales** — in-store sale history, record payments, cancel/restore
- **Cash book** — money in/out; POS sales post automatically, online orders are counted in the totals
- **Reports** — profit, best sellers, monthly revenue (POS + online), backups & CSV export
- **Content / Feedback / Settings** — homepage content, customer feedback moderation, settings

## 🧱 Tech Stack

- **Framework**: TanStack Start (React 19), TanStack Router (file-based routes in `src/routes/`)
- **Database**: Supabase (`src/lib/supabase.ts`; secure server functions in `src/lib/api/`)
- **Styling**: Tailwind CSS 4 + Radix UI (shadcn-style components in `src/components/ui/`)
- **State**: Zustand (`src/stores/cartStore.ts`) + TanStack Query
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts
- **Payments**: Pay on delivery now; Bakong / ABA PayWay integration in `src/lib/api/payway.functions.ts`

## 📁 Project Structure

```
src/
├── components/
│   ├── admin/        # AdminShell (nav + role guard), ProductForm, StatCard
│   ├── site/         # Navbar, Footer, ProductCard, CartDrawer, Logo, …
│   └── ui/           # shadcn/Radix UI primitives
├── hooks/            # useAuth, useCartSync, useNotifications
├── lib/
│   ├── supabase.ts        # Supabase client + DB row types
│   ├── productStore.ts    # Product & collection data layer (website catalog)
│   ├── orderStore.ts      # Online orders (create, list, status updates)
│   ├── orderStatus.ts     # Shared order status labels/colors (single source)
│   ├── pos/               # POS data layer: inventory, sales, cash book
│   │   ├── store.ts       #   backend-agnostic POS API (Supabase or local)
│   │   └── localBackend.ts #  seeded localStorage fallback
│   ├── auth.ts, authToken.ts, telegramAuth.ts
│   └── api/               # Server functions (secure admin writes, PayWay, Telegram)
├── routes/           # File-based routing (storefront + /admin/*)
└── stores/
    └── cartStore.ts  # Cart state — persisted once under "bakong-cart-store"
```

## 🛒 Managing Products

Use the **admin panel** at `/admin/products` (add/edit/delete, assign categories, images via Cloudinary). Products shown on the website live in the Supabase `products` table; POS inventory lives in `stock_items`. See `HOW-TO-ADD-PRODUCTS.md` for a step-by-step guide.

## 🚀 Getting Started

```bash
npm install        # or: bun install
npm run dev        # dev server at http://localhost:3000
npm run build      # production build
```

Environment variables go in `.env.local` (see `.env.local.example` and `PRODUCTION-SETUP.md`):

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY` (server functions — admin writes, order creation)
- `VITE_TELEGRAM_BOT_NAME`, `VITE_GOOGLE_MAPS_API_KEY` (optional features)

## 🚀 Deployment

Deployed on **Vercel** (`vercel.json` included). Run `vercel` from the project root; set the env vars above in the Vercel dashboard.

## 📚 More Guides

- `PRODUCTION-SETUP.md` — Supabase + env setup for going live
- `POS-GUIDE.md` — using the point-of-sale tools
- `USER-ROLES-GUIDE.md` — admin vs customer roles
- `TELEGRAM-SETUP.md` — Telegram login & notifications

## 📄 License

MIT License — free for personal and commercial use.

---

**Made with ❤️ using React and TanStack**
