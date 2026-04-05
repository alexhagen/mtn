# Expo Go OAuth Setup Guide

This guide explains how to configure OAuth authentication for the MTN app when using Expo Go.

## The Problem

Expo Go uses dynamic redirect URLs based on your local network IP (e.g., `exp://192.168.1.42:8081`), which changes every time you switch networks. This makes it impossible to configure a stable redirect URL in Supabase's allowlist.

## The Solution

We use a **web app relay** pattern where:
1. The native app opens OAuth in an external browser
2. After OAuth completes, Supabase redirects to your web app
3. The web app saves the session tokens to a temporary database table
4. The native app polls that table and retrieves the tokens
5. The user is signed in

This works reliably in Expo Go, development builds, and production.

## Setup Instructions

### 1. Run the Database Migration

In your Supabase dashboard:

1. Go to **SQL Editor**
2. Click **New Query**
3. Copy the contents of `supabase/migrations/20260405_auth_pending.sql`
4. Paste and click **Run**
5. Verify the `auth_pending` table was created in **Table Editor**

### 2. Configure Supabase Redirect URLs

In your Supabase dashboard:

1. Go to **Authentication** → **URL Configuration**
2. Under **Redirect URLs**, add:
   ```
   https://mtn.mtn-app.workers.dev/auth/callback
   ```
3. Click **Save**

**Important**: Replace `mtn.mtn-app.workers.dev` with your actual Cloudflare Pages/Workers domain if different.

### 3. Update Web App URL (if needed)

If your web app is deployed to a different domain, update the `WEB_APP_URL` constant in `src/contexts/AuthContext.tsx`:

```typescript
const WEB_APP_URL = 'https://your-actual-domain.com';
```

### 4. Deploy the Web App

The auth callback route (`app/auth/callback.tsx`) needs to be deployed to your web app:

```bash
npm run build:web
npm run deploy
```

Or push to GitHub if using Cloudflare Pages auto-deployment.

## How It Works

### Native App Flow (Expo Go)

```
1. User taps "Sign in with Google"
2. App generates a random nonce (UUID)
3. App opens Safari/Chrome with OAuth URL
   └─ redirectTo: https://mtn.mtn-app.workers.dev/auth/callback?nonce=<uuid>
4. User signs in with Google
5. Supabase redirects to web app callback with ?code=xxx&nonce=<uuid>
6. Web app exchanges code for session tokens
7. Web app saves tokens to auth_pending table (keyed by nonce)
8. User switches back to Expo Go app (or iOS auto-returns)
9. App polls auth_pending table every 2 seconds
10. App finds tokens, calls setSession(), deletes the row
11. User is signed in ✓
```

### Web App Flow (Browser)

```
1. User clicks "Sign in with Google"
2. Supabase redirects to OAuth provider
3. User signs in
4. Supabase redirects to /auth/callback?code=xxx (no nonce)
5. Web app exchanges code for session
6. Web app redirects to home page
7. User is signed in ✓
```

## Security

- **Nonce**: A 128-bit cryptographically random UUID acts as the security gate. It's practically unguessable.
- **Expiration**: The `auth_pending` table has a cleanup function that deletes records older than 10 minutes.
- **RLS**: Row-level security is enabled, but policies allow anonymous access (gated by nonce secrecy).
- **One-time use**: The native app deletes the row immediately after retrieving tokens.

## Troubleshooting

### "Sign in timed out"

The native app polls for 3 minutes. If this error occurs:
- Check that the web app is deployed and accessible
- Verify the `WEB_APP_URL` constant matches your actual domain
- Check Supabase logs for errors in the callback
- Ensure the `auth_pending` table exists and has correct RLS policies

### "No authorization code received"

- Verify the redirect URL in Supabase matches exactly: `https://mtn.mtn-app.workers.dev/auth/callback`
- Check that OAuth providers (Google/GitHub/Apple) have the correct callback URL: `https://your-project.supabase.co/auth/v1/callback`

### Web app shows error after OAuth

- Check browser console for errors
- Verify Supabase credentials are configured in web app environment variables
- Check Supabase logs for auth errors

### Tokens not appearing in auth_pending table

- Verify the migration ran successfully
- Check RLS policies allow anonymous insert
- Check web app logs for database errors

## Development vs. Production

| Environment | Redirect URL | Works? |
|-------------|--------------|--------|
| **Expo Go** | `exp://192.168.x.x:8081` (dynamic) | ✅ Via web relay |
| **Dev Build** | `mtn://` (stable) | ✅ Direct or via web relay |
| **Production** | `mtn://` (stable) | ✅ Direct or via web relay |
| **Web Browser** | `https://your-domain.com` | ✅ Direct |

The web relay pattern works in all environments, so you can use it everywhere for consistency.

## Alternative: Development Builds

If you prefer not to use the web relay pattern, you can build a development build:

```bash
# Android (works on Linux)
npx expo run:android

# iOS (requires Mac + Xcode)
npx expo run:ios
```

Development builds use the stable `mtn://` scheme, so you can add `mtn://**` to Supabase's redirect URLs and use the simpler in-app browser flow.

However, the web relay pattern is recommended because:
- Works in Expo Go (no build required)
- Works in all environments consistently
- No need to maintain separate OAuth flows for dev vs. production
