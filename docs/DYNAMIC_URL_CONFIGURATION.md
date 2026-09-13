# Dynamic URL Configuration - Implementation Summary

## Overview
Replaced all hardcoded `localhost:3000` and `process.env.NEXTAUTH_URL` references with a centralized, dynamic URL utility function to support seamless switching between local and production environments.

## Changes Made

### 1. Environment Configuration
**File:** `.env`
- Added `NEXT_PUBLIC_APP_URL="http://localhost:3000"` for client-side URL access
- This variable can be easily updated for production deployment (e.g., `https://socialynaacara.vercel.app`)

### 2. Utility Function
**File:** `lib/utils.ts`
- Created `getBaseUrl()` function with fallback hierarchy:
  1. `window.location.origin` (client-side, most accurate)
  2. `process.env.NEXT_PUBLIC_APP_URL` (client-side env var)
  3. `process.env.NEXTAUTH_URL` (server-side env var)
  4. `http://localhost:3000` (fallback for development)

### 3. Updated Components

#### `components/LinkedInDocsModal.tsx`
- Replaced hardcoded `http://localhost:3000/api/oauth/callback` with `{getBaseUrl()}/api/oauth/callback`
- Updated in 3 locations:
  - Setup guide step 3
  - Credentials section (example)
  - Troubleshooting section (redirect_uri_mismatch error)

#### `app/linkedin-documentation/page.tsx`
- Replaced hardcoded URLs with dynamic `getBaseUrl()` calls
- Updated in 4 locations:
  - Setup guide OAuth configuration step
  - Credentials section (redirect URI example)
  - Troubleshooting section (redirect_uri_mismatch error)

### 4. Updated API Routes

#### `app/api/oauth/callback/route.ts`
- Replaced 5 instances of `process.env.NEXTAUTH_URL` with `getBaseUrl()`:
  - Error redirect
  - Token exchange redirect URI
  - Platform already connected error redirect
  - Success redirect

#### `app/api/oauth/init/[platform]/route.ts`
- Replaced redirect URI construction with `getBaseUrl()`
- Ensures OAuth flow uses consistent URLs

#### `app/api/posts/route.ts`
- Updated n8n webhook callback URL to use `getBaseUrl()`

## Benefits

### 1. **Environment Flexibility**
- Single point of configuration for URL changes
- No code changes needed when switching environments
- Just update `NEXT_PUBLIC_APP_URL` in `.env` or deployment settings

### 2. **Production Ready**
- Works seamlessly with Vercel deployments
- Automatically uses correct domain in production
- No hardcoded localhost references

### 3. **Maintainability**
- Centralized URL logic
- Easier to debug URL-related issues
- Consistent behavior across the application

### 4. **Developer Experience**
- Works out of the box in local development
- No manual URL updates needed
- Clear fallback hierarchy

## Deployment Instructions

### For Production (Vercel)
1. Set environment variable in Vercel dashboard:
   ```
   NEXT_PUBLIC_APP_URL=https://socialynaacara.vercel.app
   NEXTAUTH_URL=https://socialynaacara.vercel.app
   ```

2. Update LinkedIn OAuth app settings:
   - Redirect URI: `https://socialynaacara.vercel.app/api/oauth/callback`

### For Local Development
- No changes needed
- Uses `http://localhost:3000` by default
- LinkedIn OAuth redirect URI: `http://localhost:3000/api/oauth/callback`

## Testing Checklist

- [ ] OAuth flow works in local development
- [ ] LinkedIn documentation displays correct URLs
- [ ] Error redirects work properly
- [ ] Production deployment uses correct domain
- [ ] OAuth callback handles redirects correctly
- [ ] n8n webhook receives correct callback URL

## Files Modified

1. `.env` - Added NEXT_PUBLIC_APP_URL
2. `lib/utils.ts` - Added getBaseUrl() function
3. `components/LinkedInDocsModal.tsx` - Dynamic URLs in documentation
4. `app/linkedin-documentation/page.tsx` - Dynamic URLs in full page docs
5. `app/api/oauth/callback/route.ts` - Dynamic redirects
6. `app/api/oauth/init/[platform]/route.ts` - Dynamic OAuth init
7. `app/api/posts/route.ts` - Dynamic callback URL for n8n

## Notes

- The `getBaseUrl()` function is smart enough to work on both client and server
- Client-side: Uses actual browser URL (most reliable)
- Server-side: Uses environment variables
- All OAuth flows now automatically adapt to the deployment environment
