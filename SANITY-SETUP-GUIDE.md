# Sanity.io CMS Setup Guide

## 🎯 Complete Step-by-Step Setup

Follow these steps to set up Sanity.io as your professional CMS!

---

## 📋 **Step 1: Create Sanity Account**

1. Go to: [sanity.io](https://www.sanity.io/)
2. Click **"Get started"** or **"Sign up"**
3. Sign up with:
   - Google account (recommended)
   - GitHub account
   - Or email
4. Verify your email if needed

---

## 💻 **Step 2: Install Sanity CLI**

Open your terminal and run:

```bash
npm install -g @sanity/cli
```

Wait for installation to complete (may take 2-3 minutes).

---

## 🚀 **Step 3: Create Sanity Project**

### **In your terminal:**

```bash
cd "/Users/limsometa/Desktop/Wep App/shop-bakong-joy"
```

### **Initialize Sanity:**

```bash
npm create sanity@latest -- --template clean --create-project "Shop Bakong Joy" --dataset production
```

### **Follow the prompts:**

1. **Login to Sanity?** → Yes (it will open browser)
2. **Project name?** → "Shop Bakong Joy" (or your choice)
3. **Use default dataset?** → Yes
4. **Project output path?** → `./sanity` (or press Enter)
5. **Select project template?** → Clean project with no predefined schemas
6. **Package manager?** → npm

---

## 📁 **Step 4: Create Product Schema**

After Sanity is installed, create the schema:

### **Create file:** `sanity/schemas/product.ts`

```typescript
import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'product',
  title: 'Product',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
    }),
    defineField({
      name: 'productType',
      title: 'Product Type',
      type: 'string',
      options: {
        list: [
          {title: 'Clothing', value: 'Clothing'},
          {title: 'Accessories', value: 'Accessories'},
          {title: 'Electronics', value: 'Electronics'},
          {title: 'Home & Kitchen', value: 'Home & Kitchen'},
          {title: 'Sports & Fitness', value: 'Sports & Fitness'},
        ],
      },
    }),
    defineField({
      name: 'price',
      title: 'Price',
      type: 'number',
      validation: (Rule) => Rule.required().positive(),
    }),
    defineField({
      name: 'images',
      title: 'Images',
      type: 'array',
      of: [
        {
          type: 'image',
          options: {
            hotspot: true,
          },
          fields: [
            {
              name: 'alt',
              type: 'string',
              title: 'Alternative text',
            },
          ],
        },
      ],
    }),
    defineField({
      name: 'collections',
      title: 'Collections',
      type: 'array',
      of: [{type: 'reference', to: {type: 'collection'}}],
    }),
    defineField({
      name: 'variants',
      title: 'Variants',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            {name: 'title', type: 'string', title: 'Variant Title'},
            {name: 'price', type: 'number', title: 'Price'},
            {name: 'availableForSale', type: 'boolean', title: 'Available for Sale', initialValue: true},
          ],
        },
      ],
    }),
  ],
  preview: {
    select: {
      title: 'title',
      media: 'images.0',
      price: 'price',
    },
    prepare(selection) {
      const {title, media, price} = selection
      return {
        title: title,
        subtitle: price ? `$${price}` : 'No price set',
        media: media,
      }
    },
  },
})
```

### **Create file:** `sanity/schemas/collection.ts`

```typescript
import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'collection',
  title: 'Collection',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
    }),
  ],
})
```

### **Update:** `sanity/schemas/index.ts`

```typescript
import product from './product'
import collection from './collection'

export const schemaTypes = [product, collection]
```

---

## 🎨 **Step 5: Start Sanity Studio**

```bash
cd sanity
npm run dev
```

Sanity Studio will open at: `http://localhost:3333`

---

## 📦 **Step 6: Install Sanity Client in Your Project**

In a **new terminal** (keep Sanity Studio running):

```bash
cd "/Users/limsometa/Desktop/Wep App/shop-bakong-joy"
npm install @sanity/client @sanity/image-url
```

---

## 🔧 **Step 7: Configure Sanity Client**

### **Create file:** `src/lib/sanity.ts`

```typescript
import { createClient } from '@sanity/client'
import imageUrlBuilder from '@sanity/image-url'

export const sanityClient = createClient({
  projectId: 'YOUR_PROJECT_ID', // Find in sanity.json or manage.sanity.io
  dataset: 'production',
  useCdn: true,
  apiVersion: '2024-01-01',
})

const builder = imageUrlBuilder(sanityClient)

export function urlFor(source: any) {
  return builder.image(source)
}

// Fetch all products
export async function getProducts() {
  return sanityClient.fetch(`
    *[_type == "product"] {
      _id,
      title,
      "slug": slug.current,
      description,
      productType,
      price,
      "images": images[]{
        "url": asset->url,
        alt
      },
      variants,
      "collections": collections[]->title
    }
  `)
}

// Fetch product by slug
export async function getProductBySlug(slug: string) {
  return sanityClient.fetch(`
    *[_type == "product" && slug.current == $slug][0] {
      _id,
      title,
      "slug": slug.current,
      description,
      productType,
      price,
      "images": images[]{
        "url": asset->url,
        alt
      },
      variants,
      "collections": collections[]->title
    }
  `, { slug })
}

// Fetch all collections
export async function getCollections() {
  return sanityClient.fetch(`
    *[_type == "collection"] {
      _id,
      title,
      "slug": slug.current,
      description
    }
  `)
}
```

---

## 🔑 **Step 8: Get Your Project ID**

### **Method 1: From Sanity Studio**
1. Go to `http://localhost:3333`
2. Look at the URL or check `sanity/sanity.config.ts`

### **Method 2: From Sanity Dashboard**
1. Go to [manage.sanity.io](https://manage.sanity.io)
2. Click your project
3. Copy the **Project ID**

### **Update the client:**
Replace `YOUR_PROJECT_ID` in `src/lib/sanity.ts` with your actual project ID.

---

## 📝 **Step 9: Add Products in Sanity Studio**

1. Go to `http://localhost:3333`
2. Click **"Product"** in the sidebar
3. Click **"Create new Product"**
4. Fill in:
   - Title
   - Generate slug (click "Generate")
   - Description
   - Product Type
   - Price
   - Upload images
   - Add variants (optional)
5. Click **"Publish"**

---

## 🔄 **Step 10: Update Your Store to Use Sanity**

### **Update:** `src/lib/localStore.ts`

Add at the top:
```typescript
import { getProducts as getSanityProducts, getProductBySlug as getSanityProductBySlug, getCollections as getSanityCollections } from './sanity'
```

Replace the functions with Sanity versions or create new ones.

---

## 🎉 **Step 11: Test Everything**

1. **Sanity Studio:** `http://localhost:3333`
2. **Your Store:** `http://localhost:3000`
3. Add a product in Sanity
4. Refresh your store
5. Product should appear!

---

## 🌐 **Step 12: Deploy Sanity Studio**

When ready to deploy:

```bash
cd sanity
npm run build
npm run deploy
```

Your studio will be at: `https://YOUR_PROJECT.sanity.studio`

---

## 💡 **Benefits of Sanity**

✅ **Professional CMS** - Industry standard  
✅ **Real-time updates** - Changes appear instantly  
✅ **Image optimization** - Automatic CDN  
✅ **Free tier** - 100k API requests/month  
✅ **Collaborative** - Multiple users  
✅ **Version history** - Track all changes  
✅ **Custom workflows** - Approval processes  

---

## 📊 **Free Tier Limits**

- **API Requests:** 100,000/month
- **Bandwidth:** 10 GB/month
- **Assets:** 5 GB storage
- **Users:** 3 admin users
- **More than enough for most stores!**

---

## 🔒 **Security**

- **API Tokens:** For production, use tokens
- **CORS:** Configure allowed origins
- **Roles:** Set user permissions

---

## 📚 **Resources**

- **Docs:** [sanity.io/docs](https://www.sanity.io/docs)
- **Schemas:** [sanity.io/docs/schema-types](https://www.sanity.io/docs/schema-types)
- **GROQ:** [sanity.io/docs/groq](https://www.sanity.io/docs/groq)
- **Community:** [slack.sanity.io](https://slack.sanity.io)

---

## ✅ **Quick Checklist**

- [ ] Create Sanity account
- [ ] Install Sanity CLI
- [ ] Create Sanity project
- [ ] Create product schema
- [ ] Create collection schema
- [ ] Start Sanity Studio
- [ ] Install Sanity client
- [ ] Configure client with Project ID
- [ ] Add test product
- [ ] Update store to fetch from Sanity
- [ ] Test everything works

---

**Need help? Let me know which step you're on!** 🚀
