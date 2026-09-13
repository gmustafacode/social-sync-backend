# GitHub OAuth - Quick Setup Checklist

## ⚡ Quick Start (5 Minutes)

### 1️⃣ Create GitHub OAuth App
- Go to: https://github.com/settings/developers
- Click: **OAuth Apps** → **New OAuth App**
- Fill in:
  - **Homepage URL**: `http://localhost:3000`
  - **Callback URL**: `http://localhost:3000/api/auth/callback/github`
- Click: **Register application**
- Click: **Generate a new client secret**
- ✅ Copy Client ID and Client Secret

### 2️⃣ Update `.env` File
```env
GITHUB_CLIENT_ID="paste_your_client_id_here"
GITHUB_CLIENT_SECRET="paste_your_client_secret_here"
```

### 3️⃣ Restart Dev Server
```bash
npm run dev
```

### 4️⃣ Test It
- Go to: http://localhost:3000/login
- Click: **GitHub** button
- Authorize the app
- ✅ You should be logged in!

---

## 🔒 Security Checklist

- [ ] Client secret is in `.env` (not `.env.example`)
- [ ] `.env` is in `.gitignore`
- [ ] `NEXTAUTH_SECRET` is set
- [ ] Callback URL matches exactly in GitHub settings

---

## 🚀 Production Deployment

### Update GitHub OAuth App
1. Add production callback URL:
   ```
   https://yourdomain.com/api/auth/callback/github
   ```

### Update Environment Variables
```env
NEXTAUTH_URL="https://yourdomain.com"
GITHUB_CLIENT_ID="your_client_id"
GITHUB_CLIENT_SECRET="your_client_secret"
```

---

## 🐛 Common Issues

| Problem | Solution |
|---------|----------|
| "redirect_uri_mismatch" | Check callback URL in GitHub settings |
| "invalid_client" | Verify client ID and secret in `.env` |
| Button doesn't work | Restart dev server after changing `.env` |
| No email received | OAuth users don't need email verification |

---

## 📋 What Was Changed

### Files Modified:
1. ✅ `lib/auth.ts` - Added GitHubProvider
2. ✅ `app/login/page.tsx` - Added GitHub button
3. ✅ `app/signup/page.tsx` - Added GitHub button
4. ✅ `.env` - Added GitHub credentials

### No Database Changes Required
NextAuth.js handles everything automatically!

---

## 🎯 Features

- ✅ Sign in with GitHub
- ✅ Sign up with GitHub
- ✅ Auto-create user accounts
- ✅ Auto-verify email
- ✅ Link existing accounts by email
- ✅ Secure token handling
- ✅ CSRF protection
- ✅ Works alongside Google OAuth

---

## 📞 Need Help?

See full documentation: `docs/GITHUB_OAUTH_SETUP.md`
