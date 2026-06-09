# Shop Bakong Joy - E-commerce Store

A modern, free e-commerce storefront built with React and TanStack Start. **No external dependencies or paid services required!**

## ✨ Features

- 🆓 **100% Free** - No Shopify or external API costs
- 🛍️ **Full Shopping Experience** - Browse products, add to cart, manage quantities
- 📱 **Fully Responsive** - Works perfectly on mobile, tablet, and desktop
- 🎨 **Modern UI** - Built with Tailwind CSS and Radix UI components
- 🔍 **Search & Filter** - Search products by name, description, type, or collection
- 📂 **Categories** - Organized by collections and product types
- 💾 **Persistent Cart** - Cart data saved in browser localStorage
- ⚡ **Fast & Lightweight** - No external API calls, everything runs locally

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (or Node.js)

### Installation

```bash
# Install dependencies
bun install

# Start development server
bun dev

# Build for production
bun build

# Preview production build
bun preview
```

The app will be available at `http://localhost:3000`

## 📁 Project Structure

```
src/
├── components/
│   ├── site/          # Custom components (Navbar, Footer, ProductCard, CartDrawer)
│   └── ui/            # Radix UI components
├── data/
│   └── products.json  # Product database (edit this to add/modify products)
├── hooks/             # Custom React hooks
├── lib/
│   ├── localStore.ts  # Local product & cart API
│   └── shopify.ts     # (Legacy - can be removed)
├── routes/            # File-based routing
│   ├── index.tsx      # Home page
│   ├── shop.tsx       # Shop page
│   └── product/       # Product detail pages
├── stores/
│   └── cartStore.ts   # Cart state management (Zustand)
└── styles.css         # Global styles
```

## 🛒 Managing Products

All products are stored in `src/data/products.json`. To add or edit products:

### Add a New Product

1. Open `src/data/products.json`
2. Add a new product object to the `products` array:

```json
{
  "id": "9",
  "title": "Your Product Name",
  "description": "Product description here",
  "handle": "your-product-name",
  "productType": "Category Name",
  "price": {
    "amount": "49.99",
    "currencyCode": "USD"
  },
  "images": [
    {
      "url": "https://images.unsplash.com/photo-xxxxx",
      "altText": "Product image description"
    }
  ],
  "variants": [
    {
      "id": "9-default",
      "title": "Default",
      "price": { "amount": "49.99", "currencyCode": "USD" },
      "availableForSale": true,
      "selectedOptions": []
    }
  ],
  "collections": ["Collection Name"]
}
```

### Add Product Variants (Sizes, Colors, etc.)

```json
"variants": [
  {
    "id": "9-small",
    "title": "Small",
    "price": { "amount": "49.99", "currencyCode": "USD" },
    "availableForSale": true,
    "selectedOptions": [{ "name": "Size", "value": "Small" }]
  },
  {
    "id": "9-medium",
    "title": "Medium",
    "price": { "amount": "49.99", "currencyCode": "USD" },
    "availableForSale": true,
    "selectedOptions": [{ "name": "Size", "value": "Medium" }]
  }
]
```

### Add Collections/Categories

Add to the `collections` array in `products.json`:

```json
{
  "id": "col-9",
  "title": "Your Collection",
  "handle": "your-collection",
  "description": "Collection description"
}
```

Then reference it in products:

```json
"collections": ["Your Collection", "Best Sellers"]
```

## 🎨 Finding Product Images

Use free image sources:

- [Unsplash](https://unsplash.com/) - High-quality free photos
- [Pexels](https://pexels.com/) - Free stock photos
- [Pixabay](https://pixabay.com/) - Free images and videos

Example Unsplash URL format:

```
https://images.unsplash.com/photo-1234567890?w=800&q=80
```

## 🛍️ Current Products

The store comes with 8 sample products:

1. Classic White T-Shirt (Clothing)
2. Leather Backpack (Accessories)
3. Wireless Headphones (Electronics)
4. Minimalist Watch (Accessories)
5. Ceramic Coffee Mug (Home & Kitchen)
6. Yoga Mat (Sports & Fitness)
7. Denim Jacket (Clothing)
8. Sunglasses (Accessories)

## 📦 Collections

- Best Sellers
- New Arrivals
- Summer Collection
- Electronics
- Clothing
- Accessories
- Home & Kitchen
- Sports & Fitness

## 🔧 Tech Stack

- **Framework**: TanStack Start (React 19)
- **Routing**: TanStack Router
- **Styling**: Tailwind CSS 4.2
- **UI Components**: Radix UI
- **State Management**: Zustand
- **Data Fetching**: TanStack Query
- **Form Handling**: React Hook Form + Zod
- **Build Tool**: Vite
- **Package Manager**: Bun

## 💡 Features Explained

### Shopping Cart

- Stored in browser localStorage
- Persists across page refreshes
- Add/remove items
- Update quantities
- View total price

### Search & Filter

- Real-time search
- Filters by product name, description, type, and collections
- Category navigation in navbar

### Product Pages

- Image gallery
- Variant selection (sizes, colors, etc.)
- Add to cart
- Stock availability

## 🚀 Deployment

This is a static site that can be deployed to:

- **Vercel** (Recommended)
- **Netlify**
- **GitHub Pages**
- **Cloudflare Pages**
- Any static hosting service

### Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

## 📝 Customization

### Change Store Name

Edit `src/components/site/Navbar.tsx` and `src/routes/__root.tsx`

### Change Colors

Edit `src/styles.css` - modify the CSS variables

### Add Payment Processing

To add real checkout:

1. Integrate Stripe, PayPal, or another payment processor
2. Update `src/lib/localStore.ts` `getCheckoutUrl()` function
3. Create a checkout page/route

## 🤝 Contributing

Feel free to fork and customize this project for your needs!

## 📄 License

MIT License - Free to use for personal and commercial projects

## 🆘 Support

For issues or questions, please open an issue on GitHub.

---

**Made with ❤️ using React and TanStack**
