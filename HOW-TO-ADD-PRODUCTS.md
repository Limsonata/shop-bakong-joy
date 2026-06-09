# How to Add Products - Step by Step Guide

## 📝 Quick Start

All products are stored in: `src/data/products.json`

## 🎯 Adding a Simple Product (No Variants)

Copy this template and add it to the `products` array:

```json
{
  "id": "9",
  "title": "Your Product Name",
  "description": "Detailed description of your product. Explain features, materials, benefits, etc.",
  "handle": "your-product-name",
  "productType": "Category Name",
  "price": {
    "amount": "49.99",
    "currencyCode": "USD"
  },
  "images": [
    {
      "url": "https://images.unsplash.com/photo-1234567890?w=800&q=80",
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
  "collections": ["Best Sellers", "New Arrivals"]
}
```

### Field Explanations:

- **id**: Unique number or string (must be unique!)
- **title**: Product name shown to customers
- **description**: Full product description
- **handle**: URL-friendly version (lowercase, hyphens, no spaces)
- **productType**: Category like "Clothing", "Electronics", "Accessories"
- **price.amount**: Price as a string with decimals
- **price.currencyCode**: "USD", "EUR", "GBP", etc.
- **images**: Array of image objects (can have multiple images)
- **variants**: At least one variant required
- **collections**: Array of collection names this product belongs to

## 👕 Adding a Product with Size Variants

For products with sizes (S, M, L, XL):

```json
{
  "id": "10",
  "title": "Premium Cotton T-Shirt",
  "description": "Soft, breathable cotton t-shirt. Perfect for everyday wear.",
  "handle": "premium-cotton-tshirt",
  "productType": "Clothing",
  "price": {
    "amount": "34.99",
    "currencyCode": "USD"
  },
  "images": [
    {
      "url": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80",
      "altText": "Premium Cotton T-Shirt"
    }
  ],
  "variants": [
    {
      "id": "10-small",
      "title": "Small",
      "price": { "amount": "34.99", "currencyCode": "USD" },
      "availableForSale": true,
      "selectedOptions": [{ "name": "Size", "value": "Small" }]
    },
    {
      "id": "10-medium",
      "title": "Medium",
      "price": { "amount": "34.99", "currencyCode": "USD" },
      "availableForSale": true,
      "selectedOptions": [{ "name": "Size", "value": "Medium" }]
    },
    {
      "id": "10-large",
      "title": "Large",
      "price": { "amount": "34.99", "currencyCode": "USD" },
      "availableForSale": true,
      "selectedOptions": [{ "name": "Size", "value": "Large" }]
    },
    {
      "id": "10-xlarge",
      "title": "X-Large",
      "price": { "amount": "34.99", "currencyCode": "USD" },
      "availableForSale": false,
      "selectedOptions": [{ "name": "Size", "value": "X-Large" }]
    }
  ],
  "collections": ["Clothing", "New Arrivals"]
}
```

**Note**: Set `availableForSale: false` for out-of-stock variants.

## 🎨 Adding a Product with Color Variants

For products with different colors:

```json
{
  "id": "11",
  "title": "Canvas Sneakers",
  "description": "Comfortable canvas sneakers. Available in multiple colors.",
  "handle": "canvas-sneakers",
  "productType": "Footwear",
  "price": {
    "amount": "59.99",
    "currencyCode": "USD"
  },
  "images": [
    {
      "url": "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=800&q=80",
      "altText": "Canvas Sneakers"
    }
  ],
  "variants": [
    {
      "id": "11-white",
      "title": "White",
      "price": { "amount": "59.99", "currencyCode": "USD" },
      "availableForSale": true,
      "selectedOptions": [{ "name": "Color", "value": "White" }]
    },
    {
      "id": "11-black",
      "title": "Black",
      "price": { "amount": "59.99", "currencyCode": "USD" },
      "availableForSale": true,
      "selectedOptions": [{ "name": "Color", "value": "Black" }]
    },
    {
      "id": "11-navy",
      "title": "Navy",
      "price": { "amount": "59.99", "currencyCode": "USD" },
      "availableForSale": true,
      "selectedOptions": [{ "name": "Color", "value": "Navy" }]
    }
  ],
  "collections": ["Footwear", "Best Sellers"]
}
```

## 🎁 Adding a Product with Multiple Options (Size + Color)

For products with both size and color:

```json
{
  "id": "12",
  "title": "Hoodie",
  "description": "Cozy fleece hoodie. Available in multiple sizes and colors.",
  "handle": "hoodie",
  "productType": "Clothing",
  "price": {
    "amount": "69.99",
    "currencyCode": "USD"
  },
  "images": [
    {
      "url": "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&q=80",
      "altText": "Hoodie"
    }
  ],
  "variants": [
    {
      "id": "12-s-black",
      "title": "Small / Black",
      "price": { "amount": "69.99", "currencyCode": "USD" },
      "availableForSale": true,
      "selectedOptions": [
        { "name": "Size", "value": "Small" },
        { "name": "Color", "value": "Black" }
      ]
    },
    {
      "id": "12-m-black",
      "title": "Medium / Black",
      "price": { "amount": "69.99", "currencyCode": "USD" },
      "availableForSale": true,
      "selectedOptions": [
        { "name": "Size", "value": "Medium" },
        { "name": "Color", "value": "Black" }
      ]
    },
    {
      "id": "12-s-gray",
      "title": "Small / Gray",
      "price": { "amount": "69.99", "currencyCode": "USD" },
      "availableForSale": true,
      "selectedOptions": [
        { "name": "Size", "value": "Small" },
        { "name": "Color", "value": "Gray" }
      ]
    },
    {
      "id": "12-m-gray",
      "title": "Medium / Gray",
      "price": { "amount": "69.99", "currencyCode": "USD" },
      "availableForSale": true,
      "selectedOptions": [
        { "name": "Size", "value": "Medium" },
        { "name": "Color", "value": "Gray" }
      ]
    }
  ],
  "collections": ["Clothing", "Winter Collection"]
}
```

## 🖼️ Adding Multiple Images

Products can have multiple images:

```json
{
  "id": "13",
  "title": "Leather Wallet",
  "description": "Genuine leather wallet with multiple card slots.",
  "handle": "leather-wallet",
  "productType": "Accessories",
  "price": {
    "amount": "45.99",
    "currencyCode": "USD"
  },
  "images": [
    {
      "url": "https://images.unsplash.com/photo-1627123424574-724758594e93?w=800&q=80",
      "altText": "Leather Wallet - Front View"
    },
    {
      "url": "https://images.unsplash.com/photo-1627123424574-724758594e93?w=800&q=80",
      "altText": "Leather Wallet - Open View"
    },
    {
      "url": "https://images.unsplash.com/photo-1627123424574-724758594e93?w=800&q=80",
      "altText": "Leather Wallet - Detail"
    }
  ],
  "variants": [
    {
      "id": "13-default",
      "title": "Default",
      "price": { "amount": "45.99", "currencyCode": "USD" },
      "availableForSale": true,
      "selectedOptions": []
    }
  ],
  "collections": ["Accessories", "Best Sellers"]
}
```

## 📂 Adding New Collections

To add a new collection, add it to the `collections` array in `products.json`:

```json
{
  "id": "col-9",
  "title": "Winter Collection",
  "handle": "winter-collection",
  "description": "Cozy products for cold weather"
}
```

Then reference it in your products:

```json
"collections": ["Winter Collection", "Best Sellers"]
```

## 🎨 Finding Free Product Images

### Unsplash (Recommended)

1. Go to [unsplash.com](https://unsplash.com)
2. Search for your product type
3. Click on an image
4. Right-click → Copy image address
5. Add `?w=800&q=80` to the end for optimization

Example: `https://images.unsplash.com/photo-1234567890?w=800&q=80`

### Pexels

1. Go to [pexels.com](https://pexels.com)
2. Search and select an image
3. Click "Download" → Copy the URL
4. Use the medium size URL

### Your Own Images

1. Upload to a service like:
   - Imgur
   - Cloudinary (free tier)
   - Your own hosting
2. Use the direct image URL

## ✅ Checklist Before Adding a Product

- [ ] Unique `id` (not used by other products)
- [ ] Clear, descriptive `title`
- [ ] Detailed `description`
- [ ] URL-friendly `handle` (lowercase, hyphens)
- [ ] Appropriate `productType`
- [ ] Valid price with 2 decimals
- [ ] At least one image with good quality
- [ ] At least one variant
- [ ] Assigned to relevant collections

## 🚨 Common Mistakes to Avoid

❌ **Duplicate IDs**: Each product must have a unique ID
❌ **Missing commas**: JSON requires commas between objects
❌ **Wrong quotes**: Use double quotes `"` not single quotes `'`
❌ **Broken image URLs**: Test image URLs in browser first
❌ **Empty variants array**: Must have at least one variant
❌ **Spaces in handle**: Use hyphens instead: `my-product` not `my product`

## 💡 Pro Tips

1. **Consistent Naming**: Use consistent product type names (e.g., always "Clothing" not sometimes "Clothes")
2. **Image Optimization**: Use `?w=800&q=80` on Unsplash URLs for faster loading
3. **SEO-Friendly**: Write descriptive titles and descriptions
4. **Collections**: Use collections to create featured sections (Sale, New, etc.)
5. **Stock Management**: Set `availableForSale: false` for out-of-stock items

## 🔄 After Adding Products

1. Save `products.json`
2. Refresh your browser
3. Check the shop page
4. Test adding to cart
5. Verify product detail page

---

**Need help? Check the README.md or MIGRATION-SUMMARY.md files!**
