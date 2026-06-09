# User Roles Guide - Admin & Regular Users

## 🎯 Two User Roles

Your store now has **2 types of users**:

1. **👤 Regular Users** (Customers)
2. **🛡️ Admins** (Store Managers)

---

## 🔐 Demo Accounts

### **Admin Account:**

- **Email:** `admin@shop.com`
- **Password:** `admin123`
- **Access:** Full admin panel + shopping

### **Regular User Account:**

- **Email:** `user@shop.com`
- **Password:** `user123`
- **Access:** Shopping only (no admin panel)

---

## 👤 Regular User Features

### **What Users Can Do:**

- ✅ Browse products
- ✅ Search and filter
- ✅ Add to cart
- ✅ View cart
- ✅ Checkout (demo)
- ✅ View account page
- ✅ See order history (coming soon)

### **What Users CANNOT Do:**

- ❌ Access admin panel
- ❌ Add/edit/delete products
- ❌ Manage categories
- ❌ View admin dashboard

### **User Pages:**

- `/` - Home page
- `/shop` - Shop page
- `/product/:handle` - Product details
- `/account` - User account page
- `/admin/login` - Login/Register page

---

## 🛡️ Admin Features

### **What Admins Can Do:**

- ✅ Everything users can do, PLUS:
- ✅ Access admin dashboard
- ✅ Add/edit/delete products
- ✅ Manage categories
- ✅ View store settings
- ✅ Manage store configuration

### **Admin Pages:**

- `/admin` - Admin dashboard
- `/admin/products` - Manage products
- `/admin/categories` - Manage categories
- `/admin/settings` - Store settings
- `/account` - Account page (with admin link)

---

## 🚀 How to Use

### **For Regular Users:**

1. **Go to:** `http://localhost:3000`
2. **Click:** "Login" in navbar
3. **Login with:**
   - Email: `user@shop.com`
   - Password: `user123`
4. **Or Register:** Create new account (always creates regular user)
5. **Shop:** Browse and add to cart
6. **Account:** Click user icon in navbar

### **For Admins:**

1. **Go to:** `http://localhost:3000/admin/login`
2. **Login with:**
   - Email: `admin@shop.com`
   - Password: `admin123`
3. **Access:** Admin dashboard
4. **Manage:** Products, categories, settings
5. **Shop:** Can also shop like regular users

---

## 📱 User Interface

### **Navbar (Not Logged In):**

```
[Logo] [Home] [Shop] [Categories] [Search] [Login] [Cart] [Menu]
```

### **Navbar (Logged In as User):**

```
[Logo] [Home] [Shop] [Categories] [Search] [👤] [Cart] [Menu]
```

### **Navbar (Logged In as Admin):**

```
[Logo] [Home] [Shop] [Categories] [Search] [👤] [Cart] [Menu]
```

(Admin icon shows in account page)

---

## 🔄 User Flow

### **New Customer:**

1. Visit website
2. Browse products
3. Click "Login" or "Register"
4. Create account (becomes regular user)
5. Shop and checkout

### **Admin:**

1. Login with admin credentials
2. Go to `/admin` dashboard
3. Manage products and categories
4. Can also shop on main site

---

## 🎨 Account Page

### **For Regular Users:**

- Profile information
- Order history
- Logout button

### **For Admins:**

- Profile information
- Order history
- **Admin Access card** (link to admin dashboard)
- Logout button

---

## 🔒 Security

### **Authentication:**

- Stored in localStorage
- Session persists across page refreshes
- Logout clears session

### **Role-Based Access:**

- Admin pages check for admin role
- Redirects to login if not authenticated
- Redirects to home if user tries to access admin

### **Password Protection:**

- Admin panel requires admin role
- Regular users cannot access admin pages
- Separate login for admin and users

---

## 📝 How to Add More Users

### **In Code (Demo):**

Edit `src/lib/auth.ts`, find `DEMO_USERS` array:

```typescript
const DEMO_USERS = [
  {
    id: "1",
    email: "admin@shop.com",
    password: "admin123",
    name: "Admin User",
    role: "admin",
    createdAt: Date.now(),
  },
  {
    id: "2",
    email: "user@shop.com",
    password: "user123",
    name: "Regular User",
    role: "user",
    createdAt: Date.now(),
  },
  // Add more users here
  {
    id: "3",
    email: "newuser@shop.com",
    password: "password123",
    name: "New User",
    role: "user", // or "admin"
    createdAt: Date.now(),
  },
];
```

### **In Production:**

- Use a real database (MongoDB, PostgreSQL)
- Implement proper authentication (JWT, sessions)
- Add password hashing (bcrypt)
- Add email verification
- Add password reset

---

## 🎯 Quick Test

### **Test Regular User:**

1. Go to `http://localhost:3000/admin/login`
2. Login as: `user@shop.com` / `user123`
3. Try to go to `/admin` - Should redirect to home
4. Can shop normally

### **Test Admin:**

1. Go to `http://localhost:3000/admin/login`
2. Login as: `admin@shop.com` / `admin123`
3. Go to `/admin` - Should see dashboard
4. Can manage products
5. Can also shop on main site

---

## 🔄 Switching Accounts

1. **Logout:** Click user icon → Logout
2. **Login:** Click "Login" in navbar
3. **Switch:** Login with different account

---

## 💡 Tips

1. **Admin Access:** Only admins can access `/admin/*` pages
2. **User Registration:** New registrations create regular users (not admins)
3. **Role Display:** Account page shows user role
4. **Admin Badge:** Admins see shield icon next to role
5. **Persistent Login:** Session saved in localStorage

---

## 🚀 URLs Summary

| Page                  | URL                 | Access          |
| --------------------- | ------------------- | --------------- |
| **Home**              | `/`                 | Everyone        |
| **Shop**              | `/shop`             | Everyone        |
| **Product**           | `/product/:handle`  | Everyone        |
| **Login**             | `/admin/login`      | Everyone        |
| **Account**           | `/account`          | Logged in users |
| **Admin Dashboard**   | `/admin`            | Admins only     |
| **Manage Products**   | `/admin/products`   | Admins only     |
| **Manage Categories** | `/admin/categories` | Admins only     |
| **Settings**          | `/admin/settings`   | Admins only     |

---

## ✅ Features Implemented

- ✅ User authentication (login/register)
- ✅ Role-based access control
- ✅ Admin dashboard
- ✅ User account page
- ✅ Login/logout functionality
- ✅ Protected admin routes
- ✅ User/admin role display
- ✅ Navbar user icon
- ✅ Demo accounts

---

**Your store now has complete user management with admin and regular user roles!** 🎉

**Try it:** `http://localhost:3000/admin/login`
