# Login Troubleshooting Guide

## 🔍 Testing the Login System

### **Step 1: Open Browser Console**
1. Open your browser (Chrome/Firefox/Safari)
2. Press `F12` or `Cmd+Option+I` (Mac) to open Developer Tools
3. Click on the "Console" tab

### **Step 2: Go to Login Page**
```
http://localhost:3000/admin/login
```

### **Step 3: Try to Login**

**Admin Account:**
- Email: `admin@shop.com`
- Password: `admin123`

**User Account:**
- Email: `user@shop.com`
- Password: `user123`

### **Step 4: Check Console**

After clicking "Login", you should see in the console:
```
Attempting login with: admin@shop.com
Login result: { success: true, user: {...} }
```

---

## 🐛 Common Issues & Fixes

### **Issue 1: Nothing happens when clicking Login**
**Check:**
- Is the form submitting? (Check console for logs)
- Are there any red errors in console?

**Fix:**
- Make sure you filled in both email and password
- Check browser console for errors

### **Issue 2: "Login failed" error**
**Check:**
- Did you type the email/password correctly?
- Email: `admin@shop.com` (not admin@shop.com with typo)
- Password: `admin123` (case sensitive)

**Fix:**
- Copy-paste the credentials from the demo box
- Make sure no extra spaces

### **Issue 3: Login succeeds but doesn't redirect**
**Check:**
- Do you see "Welcome back" toast message?
- Check console for navigation errors

**Fix:**
- The page should redirect automatically after 0.5 seconds
- If not, manually go to `/admin` for admin or `/` for user

### **Issue 4: localStorage errors**
**Check:**
- Is localStorage enabled in your browser?
- Are you in private/incognito mode?

**Fix:**
- Exit private browsing mode
- Enable localStorage in browser settings

---

## 🧪 Manual Test

### **Test in Browser Console:**

Open console and run:

```javascript
// Test if auth functions work
const { login } = await import('/src/lib/auth.ts');
const result = login('admin@shop.com', 'admin123');
console.log('Login result:', result);

// Check if user is saved
const stored = localStorage.getItem('shop-auth');
console.log('Stored auth:', stored);
```

---

## ✅ Expected Behavior

### **Successful Admin Login:**
1. Enter: `admin@shop.com` / `admin123`
2. Click "Login"
3. See: "Welcome back, Admin User!" toast
4. Redirect to: `/admin` (Admin Dashboard)

### **Successful User Login:**
1. Enter: `user@shop.com` / `user123`
2. Click "Login"
3. See: "Welcome back, Regular User!" toast
4. Redirect to: `/` (Home page)

---

## 🔧 Quick Fixes

### **Fix 1: Clear localStorage**
```javascript
// In browser console:
localStorage.clear();
location.reload();
```

### **Fix 2: Check if server is running**
```bash
# In terminal:
npm run dev
```

### **Fix 3: Hard refresh**
- Press `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
- This clears cache

---

## 📝 What to Check

- [ ] Server is running (`npm run dev`)
- [ ] No errors in terminal
- [ ] No errors in browser console
- [ ] Email and password are correct
- [ ] Not in private/incognito mode
- [ ] localStorage is enabled

---

## 💡 Still Not Working?

### **Try this:**

1. **Stop the server** (Ctrl+C in terminal)

2. **Clear everything:**
```bash
rm -rf node_modules/.vite
```

3. **Restart:**
```bash
npm run dev
```

4. **Hard refresh browser** (Cmd+Shift+R)

5. **Try login again**

---

## 🆘 Debug Info to Share

If still not working, share this info:

1. **Browser:** Chrome/Firefox/Safari?
2. **Console errors:** Copy any red errors
3. **What happens:** Describe what you see
4. **Toast message:** Do you see any toast notifications?
5. **Network tab:** Any failed requests?

---

**Let me know what you see in the console and I'll help you fix it!** 🚀
