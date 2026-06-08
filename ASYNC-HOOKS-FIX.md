# AsyncLocalStorage Browser Fix

## Problem
TanStack Start was trying to use Node.js's `AsyncLocalStorage` from `node:async_hooks` in the browser, causing this error:
```
Module "node:async_hooks" has been externalized for browser compatibility. 
Cannot access "node:async_hooks.AsyncLocalStorage" in client code
```

This error was flooding the console and preventing client-side JavaScript (including the login form) from working properly.

## Solution
Created a browser-compatible polyfill for `AsyncLocalStorage` that provides the same API but works in the browser environment.

### Files Changed:

1. **`src/polyfills/async_hooks.ts`** (NEW)
   - Browser-compatible implementation of AsyncLocalStorage
   - Provides the same API as Node.js version
   - Uses simple in-memory storage instead of Node.js async context tracking

2. **`vite.config.ts`** (MODIFIED)
   - Added alias to redirect `node:async_hooks` imports to our polyfill
   - This makes Vite use our browser-compatible version instead of trying to load the Node.js module

### How It Works:
When TanStack Start (or any other code) tries to import `node:async_hooks`, Vite will automatically redirect it to our polyfill file. The polyfill provides a simplified version of AsyncLocalStorage that works in the browser.

### Testing:
1. Restart the dev server (if not auto-reloaded)
2. Open the browser console - the error should be gone
3. Try logging in at `/login` - the form should now work
4. Click "Fill Admin" or "Fill User" buttons to auto-fill credentials
5. Click "Login" - you should be redirected based on your role

### Demo Accounts:
- **Admin**: admin@shop.com / admin123 (redirects to `/admin`)
- **User**: user@shop.com / user123 (redirects to `/`)

## Status
✅ Fix applied - waiting for dev server to reload and test
