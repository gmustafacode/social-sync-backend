# GitHub OAuth Integration Guide

## Overview
This document provides step-by-step instructions for setting up GitHub OAuth authentication in your SocialSyncAra application.

---

## 1. Create GitHub OAuth App

### Step 1.1: Navigate to GitHub Developer Settings
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click on **"OAuth Apps"** in the left sidebar
3. Click **"New OAuth App"** button

### Step 1.2: Configure OAuth App Settings
Fill in the following details:

| Field | Value |
|-------|-------|
| **Application name** | SocialSyncAra (or your preferred name) |
| **Homepage URL** | `http://localhost:3000` |
| **Application description** | Social media automation platform (optional) |
| **Authorization callback URL** | `http://localhost:3000/api/auth/callback/github` |

> **Important**: The callback URL must match exactly. NextAuth.js automatically handles the `/api/auth/callback/github` route.

### Step 1.3: Register Application
1. Click **"Register application"**
2. You'll be redirected to your app's settings page

### Step 1.4: Generate Client Secret
1. On the app settings page, you'll see your **Client ID** (already generated)
2. Click **"Generate a new client secret"**
3. **Copy both values immediately** - you won't be able to see the secret again!

---

## 2. Update Environment Variables

### Step 2.1: Open `.env` File
Navigate to your project root and open the `.env` file.

### Step 2.2: Add GitHub Credentials
Replace the placeholder values with your actual GitHub OAuth credentials:

```env
# GitHub OAuth (for user authentication)
GITHUB_CLIENT_ID="your_actual_github_client_id_here"
GITHUB_CLIENT_SECRET="your_actual_github_client_secret_here"
```

### Step 2.3: Verify Other Required Variables
Ensure these are also set:

```env
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret"
```

> **Security Note**: Never commit your `.env` file to version control. It's already in `.gitignore`.

---

## 3. OAuth Flow Explanation

### How It Works

1. **User Clicks "Sign in with GitHub"**
   - User is redirected to GitHub's authorization page
   - URL: `https://github.com/login/oauth/authorize`

2. **User Grants Permission**
   - User reviews requested permissions
   - Clicks "Authorize application"

3. **GitHub Redirects Back**
   - Callback URL: `http://localhost:3000/api/auth/callback/github`
   - Includes authorization code in query params

4. **Backend Exchanges Code for Token**
   - NextAuth.js automatically exchanges the code for an access token
   - Token endpoint: `https://github.com/login/oauth/access_token`

5. **Fetch User Profile**
   - NextAuth.js fetches user data from GitHub API
   - Retrieves: GitHub ID, username, email, avatar

6. **Create or Update User Session**
   - If user exists (matched by email): Log them in
   - If new user: Create account and log them in
   - Email is automatically verified for OAuth users

---

## 4. Requested OAuth Scopes

GitHub OAuth provider requests the following scopes:

| Scope | Purpose |
|-------|---------|
| `read:user` | Read user profile information |
| `user:email` | Access user's primary verified email |

These are the **minimum required scopes** for authentication.

---

## 5. User Account Handling

### Existing User (Email Match)
- If a user with the same email already exists, they are logged in
- `allowDangerousEmailAccountLinking: true` allows linking OAuth to existing accounts

### New User
- A new user record is created in the database
- Email is automatically marked as verified
- User is logged in immediately

### Database Tables Used
- **User**: Main user account
- **Account**: OAuth provider linkage (managed by NextAuth.js)
- **Session**: User sessions (if using database sessions)

---

## 6. Security Features

### CSRF Protection
- NextAuth.js automatically handles CSRF protection
- State parameter is validated on callback

### Token Storage
- Access tokens are **never exposed to the frontend**
- Stored securely in the database (if using database sessions)
- Session cookies are HTTP-only and secure

### Environment Variable Protection
- `GITHUB_CLIENT_SECRET` is only used server-side
- Never sent to the browser

---

## 7. Error Handling

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `redirect_uri_mismatch` | Callback URL doesn't match GitHub settings | Verify callback URL is exactly `http://localhost:3000/api/auth/callback/github` |
| `invalid_client` | Wrong client ID or secret | Double-check credentials in `.env` |
| `User cancelled authorization` | User clicked "Cancel" on GitHub | User-friendly message shown, no action needed |
| `Missing email` | GitHub account has no public email | Request `user:email` scope (already configured) |

### User-Facing Error Messages
All errors are handled gracefully with user-friendly messages. Sensitive details are never exposed.

---

## 8. Testing the Integration

### Step 8.1: Start Development Server
```bash
npm run dev
```

### Step 8.2: Navigate to Login Page
Open your browser and go to:
```
http://localhost:3000/login
```

### Step 8.3: Click "GitHub" Button
- You should be redirected to GitHub
- Authorize the application
- You'll be redirected back and logged in

### Step 8.4: Verify Dashboard Access
After successful login, you should be redirected to:
```
http://localhost:3000/dashboard
```

---

## 9. Production Deployment

### Update GitHub OAuth App Settings
When deploying to production, update your GitHub OAuth app:

1. Go to your GitHub OAuth app settings
2. Update **Homepage URL** to your production domain:
   ```
   https://yourdomain.com
   ```
3. Update **Authorization callback URL**:
   ```
   https://yourdomain.com/api/auth/callback/github
   ```

### Update Environment Variables
In your production environment, set:
```env
NEXTAUTH_URL="https://yourdomain.com"
```

> **Important**: You can have multiple callback URLs by creating separate OAuth apps for development and production.

---

## 10. Multiple OAuth Providers

Your application now supports:
- ✅ **Google OAuth** (existing)
- ✅ **GitHub OAuth** (newly added)
- ✅ **Email/Password** (credentials)

All providers work simultaneously. Users can choose their preferred method.

---

## 11. Rotating Secrets

### When to Rotate
- Suspected credential leak
- Regular security maintenance
- Team member offboarding

### How to Rotate
1. Generate new client secret in GitHub
2. Update `.env` file with new secret
3. Restart your application
4. Old secret is immediately invalidated

---

## 12. Troubleshooting

### Check Environment Variables
```bash
# Verify variables are loaded (don't print secrets!)
node -e "console.log('GITHUB_CLIENT_ID:', process.env.GITHUB_CLIENT_ID ? 'Set' : 'Not Set')"
```

### Check NextAuth Configuration
The GitHub provider is configured in `lib/auth.ts`:
```typescript
GitHubProvider({
    clientId: process.env.GITHUB_CLIENT_ID || "",
    clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    allowDangerousEmailAccountLinking: true,
})
```

### Enable Debug Logging
Add to `.env.local`:
```env
NEXTAUTH_DEBUG=true
```

---

## 13. API Reference

### NextAuth.js Endpoints
| Endpoint | Purpose |
|----------|---------|
| `/api/auth/signin` | Sign in page |
| `/api/auth/callback/github` | GitHub OAuth callback |
| `/api/auth/signout` | Sign out |
| `/api/auth/session` | Get current session |

### GitHub API Endpoints Used
| Endpoint | Purpose |
|----------|---------|
| `https://github.com/login/oauth/authorize` | Authorization |
| `https://github.com/login/oauth/access_token` | Token exchange |
| `https://api.github.com/user` | User profile |

---

## 14. Compliance & Privacy

### Data Collected
- GitHub user ID
- Username
- Email address (primary verified)
- Avatar URL

### Data Usage
- Authentication and session management only
- Not shared with third parties
- Stored securely in your database

### User Rights
Users can disconnect their GitHub account from your dashboard (future feature).

---

## Summary

✅ GitHub OAuth provider added to NextAuth configuration  
✅ Environment variables configured  
✅ Login and signup pages updated with GitHub buttons  
✅ Secure token handling implemented  
✅ Error handling in place  
✅ Production-ready setup  

Your application now supports GitHub authentication alongside Google OAuth!
