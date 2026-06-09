# Admin Panel Guide

## 🎉 Your Admin Panel is Ready!

I've built you a complete admin panel to manage your store!

---

## 🔐 Access the Admin Panel

### **URL:**

```
http://localhost:3000/admin
```

### **Default Password:**

```
admin123
```

---

## 📋 Features

### **1. Dashboard** (`/admin`)

- Overview of your store
- Quick stats
- Links to all admin sections

### **2. Manage Products** (`/admin/products`)

- ✅ View all products
- ✅ Add new products
- ✅ Edit existing products
- ✅ Delete products
- ✅ Upload images (Cloudinary URLs)

### **3. Manage Categories** (`/admin/categories`)

- ✅ View all collections
- ✅ Add new categories
- ✅ Edit categories
- ✅ Delete categories

### **4. Settings** (`/admin/settings`)

- Store information
- Admin password info
- Cloudinary links
- Documentation links

---

## 🚀 How to Use

### **Step 1: Login**

1. Go to `http://localhost:3000/admin/login`
2. Enter password: `admin123`
3. Click "Login"

### **Step 2: Add a Product**

1. Click "Manage Products"
2. Click "Add Product" button
3. Fill in the form:
   - **Title**: Product name
   - **Description**: Product details
   - **Price**: Product price (e.g., 29.99)
   - **Product Type**: Category (e.g., Clothing)
   - **Image URL**: Cloudinary URL
   - **Collections**: Comma-separated (e.g., Best Sellers, New Arrivals)
4. Click "Add Product"

### **Step 3: Edit a Product**

1. Find the product card
2. Click "Edit" button
3. Update the fields
4. Click "Update Product"

### **Step 4: Delete a Product**

1. Find the product card
2. Click the trash icon
3. Confirm deletion

---

## 📸 Adding Images

### **Before Adding Products:**

1. Upload images to Cloudinary
2. Copy the image URL
3. Paste in the "Image URL" field

### **Example Cloudinary URL:**

```
https://res.cloudinary.com/YOUR_CLOUD_NAME/image/upload/w_800,q_auto,f_auto/products/tshirt.jpg
```

---

## ⚠️ Important Notes

### **Demo Mode:**

- Changes in the admin panel are **temporary**
- They won't persist after page refresh
- This is for testing and preview only

### **To Save Permanently:**

- Edit `src/data/products.json` directly
- Or build a backend API (future enhancement)

### **Why Demo Mode?**

- Your products are stored in a JSON file
- JSON files can't be edited from the browser for security
- You need a backend API to save changes permanently

---

## 🔒 Change Admin Password

Edit: `src/routes/admin/login.tsx`

Find this line (around line 18):

```typescript
const ADMIN_PASSWORD = "admin123";
```

Change to:

```typescript
const ADMIN_PASSWORD = "your-new-password";
```

---

## 🎨 Admin Panel Pages

### **Login Page**

- `/admin/login`
- Password protected
- Clean, simple interface

### **Dashboard**

- `/admin`
- Overview and quick links
- Stats display

### **Products Management**

- `/admin/products`
- Grid view of all products
- Add/Edit/Delete functionality
- Form with validation

### **Categories Management**

- `/admin/categories`
- Manage collections
- Add/Edit/Delete categories

### **Settings**

- `/admin/settings`
- Store configuration
- Documentation links
- Cloudinary info

---

## 💡 Tips

1. **Upload images first**: Always upload to Cloudinary before adding products
2. **Use consistent naming**: Name your images clearly (e.g., `tshirt-white.jpg`)
3. **Test in demo mode**: Try adding/editing before making permanent changes
4. **Keep backups**: Save a copy of `products.json` before editing

---

## 🚀 Future Enhancements

Want to make changes permanent? You can:

### **Option 1: Add a Backend API**

- Build a Node.js/Express API
- Save to database (MongoDB, PostgreSQL)
- Full CRUD operations

### **Option 2: Use a CMS**

- Integrate Sanity.io
- Use Strapi
- Connect to Contentful

### **Option 3: File-based with Git**

- Commit changes to Git
- Use GitHub API to update files
- Requires authentication

---

## 📞 Need Help?

Check these files:

- `README.md` - Project documentation
- `HOW-TO-ADD-PRODUCTS.md` - Product management guide
- `CLOUDINARY-SETUP.md` - Image hosting guide

---

## ✅ Quick Checklist

- [ ] Access admin panel at `/admin/login`
- [ ] Login with password: `admin123`
- [ ] Try adding a product (demo mode)
- [ ] Upload images to Cloudinary
- [ ] Add real products with Cloudinary URLs
- [ ] Edit `products.json` to save permanently
- [ ] Change admin password for security

---

**Your admin panel is ready to use! 🎉**

**Access it at:** `http://localhost:3000/admin`
