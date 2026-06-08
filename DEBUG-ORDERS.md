# Debug: Why Orders Aren't Showing

I've added console logging to the order flow. Here's how to diagnose what's happening.

## Step 1: Place an Order

1. Open `http://localhost:8080`
2. Press **F12** to open DevTools, click the **Console** tab
3. Login as `user@shop.com` / `user123`
4. Add a product to your cart
5. Go to checkout, fill in the form, click **"Submit order"**
6. Watch the console — you should see something like:

```
[orderStore] Order saved to localStorage: order-xxx-yyy for user: demo-user-1
[orderStore] Total orders in storage now: 1
```

If you DON'T see this:
- The order isn't saving. Check for any red errors above it.
- The form submission is failing. Look for an error toast.

## Step 2: Check My Orders

1. Click the user icon in the top right → **"View My Orders"**
2. In the console, you should see:

```
[orderStore] getMyOrders: 1 of 1 for user demo-user-1
```

If you see `0 of 1`, the filter is excluding your order — most likely a user ID mismatch (e.g., you placed the order while logged out, then logged in as a different user).

## Step 3: Check Admin Orders

1. Logout, login as `admin@shop.com` / `admin123`
2. Go to `/admin/orders`
3. You should see all orders regardless of who placed them

## Step 4: Inspect localStorage Directly

In the DevTools Console, paste:

```js
JSON.parse(localStorage.getItem('local-orders') || '[]')
```

This shows you the raw array of saved orders. You should see your order with:
- `id`
- `userId` (or null if placed as guest)
- `items`
- `total`
- `status: "pending"`
- `createdAt`

## Common Issues

### Issue: Orders disappear after login

**Cause**: The auth code clears the cart on login, but doesn't touch orders. So this shouldn't happen.

**Check**: Run `localStorage.getItem('local-orders')` in console BEFORE and AFTER logging in. They should be the same.

### Issue: I placed an order as guest, then logged in - where is it?

**Cause**: The order has `userId: null` because no one was logged in. After you log in, `getMyOrders()` shows orders matching your user ID OR with `userId: null`. So it should appear.

**Check**: Console output of `[orderStore] getMyOrders: X of Y` — if X is 0 but Y is more than 0, the filter is wrong.

### Issue: I switched accounts (admin → user) and orders are missing

**Cause**: Each account sees their own orders (matching their user ID). Admin sees all. User sees only theirs + guest orders.

### Issue: "Order submitted" page appears but the order isn't in localStorage

**Cause**: An error inside `createOrder` is being caught silently. Check console for any red errors.

## Reset Everything

If you want a clean slate, paste this in the console:

```js
localStorage.removeItem('local-orders');
localStorage.removeItem('local-cart');
localStorage.removeItem('bakong-cart-store');
location.reload();
```

## Tell Me What You See

After running through this, paste the console output here and I'll fix whatever's wrong.
