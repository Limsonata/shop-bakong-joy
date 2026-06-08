# Cloudinary Image Hosting Setup

## 🎯 Quick Start

1. **Sign up**: [cloudinary.com/users/register/free](https://cloudinary.com/users/register/free)
2. **Upload images**: Media Library → Upload
3. **Copy URLs**: Click image → Copy URL
4. **Update products.json**: Replace image URLs

---

## 📸 Your Cloudinary Cloud Name

After signing up, find your **Cloud Name** in the dashboard:
```
Dashboard → Account Details → Cloud Name
```

Example: `dxyz123abc`

---

## 🔗 Image URL Format

### Basic URL:
```
https://res.cloudinary.com/YOUR_CLOUD_NAME/image/upload/your-image.jpg
```

### Optimized URL (Recommended):
```
https://res.cloudinary.com/YOUR_CLOUD_NAME/image/upload/w_800,q_auto,f_auto/your-image.jpg
```

### With Folder:
```
https://res.cloudinary.com/YOUR_CLOUD_NAME/image/upload/products/tshirt.jpg
```

---

## 🎨 Image Optimization Parameters

### For Product Cards (400x400):
```
w_400,h_400,c_fill,q_auto,f_auto
```

### For Product Detail (800px wide):
```
w_800,q_auto,f_auto
```

### For Hero Images (1200px wide):
```
w_1200,q_auto,f_auto
```

### Parameters Explained:
- `w_` = width
- `h_` = height
- `c_fill` = crop to fill (maintains aspect ratio)
- `q_auto` = automatic quality optimization
- `f_auto` = automatic format (WebP for modern browsers)

---

## 📝 Example: Update products.json

### Replace this:
```json
"images": [
  {
    "url": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80",
    "altText": "Product Image"
  }
]
```

### With this:
```json
"images": [
  {
    "url": "https://res.cloudinary.com/YOUR_CLOUD_NAME/image/upload/w_800,q_auto,f_auto/products/your-image.jpg",
    "altText": "Product Image"
  }
]
```

---

## 🗂️ Recommended Folder Structure

```
products/
├── clothing/
├── accessories/
├── electronics/
├── home-kitchen/
└── sports-fitness/
```

---

## 💡 Tips

1. **Name files clearly**: `tshirt-white-front.jpg` not `IMG_1234.jpg`
2. **Use folders**: Organize by category
3. **Optimize images**: Use `q_auto,f_auto` parameters
4. **Multiple angles**: Upload front, back, detail shots
5. **Consistent sizing**: Use same dimensions for all product cards

---

## 🆓 Free Tier Limits

- **Storage**: 25 GB
- **Bandwidth**: 25 GB/month
- **Transformations**: 25,000/month
- **More than enough for most stores!**

---

## 🚀 Quick Upload Checklist

- [ ] Create Cloudinary account
- [ ] Note your Cloud Name
- [ ] Create "products" folder
- [ ] Upload product images
- [ ] Copy image URLs
- [ ] Update products.json
- [ ] Test in browser
- [ ] Deploy!

---

## 🔄 Batch Update Script

If you have many products, you can use find & replace:

1. Open `products.json`
2. Find: `https://images.unsplash.com`
3. Replace with: `https://res.cloudinary.com/YOUR_CLOUD_NAME/image/upload/w_800,q_auto,f_auto`
4. Manually update the image filenames

---

## 📞 Need Help?

- Cloudinary Docs: [cloudinary.com/documentation](https://cloudinary.com/documentation)
- Support: [support.cloudinary.com](https://support.cloudinary.com)

---

**Your images will load fast and look great! 🎨**
