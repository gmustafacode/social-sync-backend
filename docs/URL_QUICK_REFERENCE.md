# Quick Reference: Environment URLs

## Current Setup

### Local Development
```env
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXTAUTH_URL="http://localhost:3000"
```

### Production (Vercel)
```env
NEXT_PUBLIC_APP_URL="https://socialynaacara.vercel.app"
NEXTAUTH_URL="https://socialynaacara.vercel.app"
```

## OAuth Redirect URIs

### Local
```
http://localhost:3000/api/oauth/callback
```

### Production
```
https://socialynaacara.vercel.app/api/oauth/callback
```

## How It Works

The `getBaseUrl()` utility function automatically detects the correct URL:

```typescript
// lib/utils.ts
export function getBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  return "http://localhost:3000";
}
```

## Usage Examples

### In Components (Client-Side)
```tsx
import { getBaseUrl } from '@/lib/utils'

// Will use window.location.origin
<code>{getBaseUrl()}/api/oauth/callback</code>
```

### In API Routes (Server-Side)
```typescript
import { getBaseUrl } from '@/lib/utils'

// Will use NEXT_PUBLIC_APP_URL or NEXTAUTH_URL
const redirectUri = `${getBaseUrl()}/api/oauth/callback`
```

## Switching Environments

### To Production
1. Update `.env` or Vercel environment variables
2. Redeploy (if using Vercel)
3. Update OAuth app redirect URIs in LinkedIn Developer Portal

### Back to Local
1. Revert `.env` changes
2. Restart dev server
3. Ensure LinkedIn OAuth app has localhost redirect URI

## Common Issues

### OAuth Redirect Mismatch
**Problem:** LinkedIn returns `redirect_uri_mismatch` error

**Solution:** 
1. Check current environment URL: `console.log(getBaseUrl())`
2. Verify it matches LinkedIn app settings exactly
3. No trailing slashes!
4. Correct protocol (http for localhost, https for production)

### Wrong URL in Production
**Problem:** App uses localhost URL in production

**Solution:**
1. Verify `NEXT_PUBLIC_APP_URL` is set in Vercel
2. Redeploy to pick up new environment variable
3. Clear browser cache

### URL Not Updating
**Problem:** Changes to `.env` not reflected

**Solution:**
1. Restart Next.js dev server
2. Clear `.next` cache: `rm -rf .next`
3. Rebuild: `npm run build`
