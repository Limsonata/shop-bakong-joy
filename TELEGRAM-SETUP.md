# Telegram Login Setup Guide

This guide will help you set up Telegram authentication for your store.

## Overview

Users can now log in via:
1. **Email/Password** - Traditional login
2. **Telegram** - One-click login using Telegram Login Widget

## Setup Steps

### Step 1: Create a Telegram Bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot` command
3. Enter your bot name (e.g., "Shop Bakong Joy")
4. Enter a username for your bot (must end in "bot", e.g., "shopbakongjoybot")
5. **Save the bot token** - you'll need it later

### Step 2: Configure Domain

The Telegram Login Widget only works on domains you've authorized in BotFather.

1. Message [@BotFather](https://t.me/BotFather)
2. Send `/setdomain` command
3. Select **the same bot** whose username is in `VITE_TELEGRAM_BOT_NAME`
4. Send only the bare hostname of your live site, e.g. `biiliegrace.vercel.app`

Rules:

- Domain only: no `https://`, no path, no port (not `https://biiliegrace.vercel.app/login`).
- It must match the browser address bar exactly — `www.example.com` and `example.com` are different domains.
- `localhost`, IP addresses and Vercel preview URLs are rejected. Test the widget on the live domain (or a public tunnel domain you register with BotFather).
- You can register several domains if you use both a custom domain and a preview domain.

### Step 3: Update Environment Variables

Edit your `.env` file in the project root:

```env
# Telegram Bot Configuration
VITE_TELEGRAM_BOT_NAME=yourshopbot  # The bot username you created (without @)
```

**Note:** Replace `yourshopbot` with your actual bot username.

### Step 4: Test the Login

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to `https://<your-domain>/login` (the widget shows "Bot domain invalid" on localhost — see [Troubleshooting](#bot-domain-invalid))

3. Click the "Telegram" tab

4. Click "Continue with Telegram"

5. A popup will appear asking you to authorize via Telegram

## Features

### What's Implemented

- ✅ **One-click login** - Users log in with their Telegram account
- ✅ **Profile photo** - User's Telegram avatar (if available)
- ✅ **Auto-create account** - New users are automatically registered
- ✅ **Works with Supabase** - When Supabase is configured, users are stored in the database
- ✅ **Demo mode support** - When Supabase is not configured, works with localStorage
- ✅ **Modern UI** - Animated login page with tabbed interface

### Security Notes

The Telegram hash is already verified server-side in `verifyTelegramLogin` (`src/lib/api/security.functions.ts`) using HMAC-SHA256 with `TELEGRAM_BOT_TOKEN`, plus a 1-hour auth-date expiry check. Set `TELEGRAM_BOT_TOKEN` (and optionally `TELEGRAM_AUTH_SECRET`) on the server; the login widget itself only needs `VITE_TELEGRAM_BOT_NAME`.

## Customization

### Changing Bot Name

Update `VITE_TELEGRAM_BOT_NAME` in your `.env` file and restart the server.

### Styling

The login button uses Telegram's official colors:
- Primary: `#0088cc` (Telegram Blue)
- Hover: `#0077b3`

You can customize the styling in `TelegramLoginButton.tsx`.

### Mini App Support

For Telegram Mini Apps (running inside Telegram), the component automatically detects `window.Telegram.WebApp` and adjusts the login flow.

## Troubleshooting

### "Bot domain invalid"

This message comes from Telegram, not the app: the widget compares the page hostname with the domains linked to the bot in BotFather.

- In [@BotFather](https://t.me/BotFather), send `/setdomain`, pick the **same bot** as `VITE_TELEGRAM_BOT_NAME`, and send just the hostname (e.g. `biiliegrace.vercel.app`) — no `https://`, path, or port.
- Check the address bar: `www.biiliegrace.vercel.app` and `biiliegrace.vercel.app` are different domains.
- `localhost`, IP addresses and Vercel preview URLs will not work — open the live site instead.
- If you just changed the setting, wait a few minutes and reload in a private window.

### Widget doesn't appear

- Check that the bot name in `.env` is correct
- Check browser console for any JavaScript errors
- The widget may take a moment to load

### "Failed to load Telegram widget"

- Check your internet connection
- Telegram's CDN might be blocked (rare)
- Refresh the page and try again

## Next Steps

Consider these enhancements:

1. **Server-side verification** - Verify Telegram hash on backend for security
2. **Profile linking** - Allow users to link Telegram to existing email accounts
3. **Notifications** - Use Telegram bot to send order confirmations
4. **Share products** - Add Telegram share buttons for products

## Resources

- [Telegram Login Widget Documentation](https://core.telegram.org/widgets/login)
- [Telegram Web Apps Guide](https://core.telegram.org/bots/webapps)
- [@BotFather Commands](https://core.telegram.org/bots/features#botfather-commands)
