# Production Deployment Checklist

## Pre-Deployment

### 1. Environment Variables
- [ ] Set `NEXT_PUBLIC_APP_URL=https://socialynaacara.vercel.app` in Vercel
- [ ] Set `NEXTAUTH_URL=https://socialynaacara.vercel.app` in Vercel
- [ ] Verify all other environment variables are set in Vercel dashboard
- [ ] Generate new `NEXTAUTH_SECRET` for production (optional but recommended)

### 2. OAuth Configuration Updates

#### LinkedIn
- [ ] Go to [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps)
- [ ] Select your app
- [ ] Navigate to **Auth** tab
- [ ] Add redirect URI: `https://socialynaacara.vercel.app/api/oauth/callback`
- [ ] Verify no trailing slash
- [ ] Verify HTTPS protocol
- [ ] Save changes

#### Google OAuth
- [ ] Go to [Google Cloud Console](https://console.cloud.google.com/)
- [ ] Select your project
- [ ] Navigate to **APIs & Services** → **Credentials**
- [ ] Edit OAuth 2.0 Client ID
- [ ] Add authorized redirect URI: `https://socialynaacara.vercel.app/api/oauth/callback`
- [ ] Save changes

#### GitHub OAuth
- [ ] Go to [GitHub Developer Settings](https://github.com/settings/developers)
- [ ] Select your OAuth App
- [ ] Update **Authorization callback URL**: `https://socialynaacara.vercel.app/api/oauth/callback`
- [ ] Save changes

#### Other Platforms (if configured)
- [ ] X/Twitter: Update callback URL
- [ ] Instagram: Update redirect URI
- [ ] Reddit: Update redirect URI

### 3. Database & Services
- [ ] Verify Supabase connection strings are correct
- [ ] Test database connectivity from Vercel
- [ ] Verify Resend API key is active
- [ ] Update n8n webhook URLs if applicable

## Deployment

### 1. Deploy to Vercel
```bash
# If using Vercel CLI
vercel --prod

# Or push to main branch (if auto-deploy is enabled)
git push origin main
```

### 2. Verify Deployment
- [ ] Visit https://socialynaacara.vercel.app
- [ ] Check that homepage loads
- [ ] Verify no console errors
- [ ] Check that environment is detected correctly

### 3. Test OAuth Flows
- [ ] Test Google OAuth login
- [ ] Test GitHub OAuth login
- [ ] Test LinkedIn account connection
- [ ] Verify redirect URIs work correctly
- [ ] Check that tokens are saved properly

### 4. Test Core Features
- [ ] User registration
- [ ] User login
- [ ] Social account connection
- [ ] Post creation
- [ ] Post scheduling
- [ ] LinkedIn posting (if applicable)

## Post-Deployment

### 1. Monitor Logs
- [ ] Check Vercel deployment logs
- [ ] Monitor for OAuth errors
- [ ] Watch for database connection issues
- [ ] Check for API errors

### 2. Update Documentation
- [ ] Update README with production URL
- [ ] Document any production-specific configurations
- [ ] Update API documentation if needed

### 3. Security Review
- [ ] Verify all secrets are in environment variables (not hardcoded)
- [ ] Check that `.env` is in `.gitignore`
- [ ] Verify HTTPS is enforced
- [ ] Review CORS settings if applicable

## Rollback Plan

If issues occur:

1. **Immediate Rollback**
   ```bash
   # In Vercel dashboard, click "Redeploy" on previous working deployment
   ```

2. **Revert OAuth Changes**
   - Add back `http://localhost:3000/api/oauth/callback` to all OAuth apps
   - Keep production URLs for future attempts

3. **Check Environment Variables**
   - Verify all required variables are set
   - Check for typos in URLs
   - Ensure no trailing slashes

## Common Issues & Solutions

### Issue: OAuth redirect_uri_mismatch
**Solution:**
1. Verify exact URL in OAuth provider settings
2. Check for trailing slashes (should NOT have one)
3. Ensure HTTPS protocol
4. Clear browser cache and try again

### Issue: Database connection errors
**Solution:**
1. Verify `DATABASE_URL` and `DIRECT_URL` are correct
2. Check Supabase connection pooling settings
3. Verify IP allowlist in Supabase (if applicable)

### Issue: Wrong URL being used
**Solution:**
1. Verify `NEXT_PUBLIC_APP_URL` is set in Vercel
2. Redeploy to pick up new environment variable
3. Clear Vercel build cache if needed

### Issue: NextAuth errors
**Solution:**
1. Verify `NEXTAUTH_URL` matches deployment URL
2. Check `NEXTAUTH_SECRET` is set
3. Verify OAuth provider credentials are correct

## Success Criteria

Deployment is successful when:
- ✅ Application loads at https://socialynaacara.vercel.app
- ✅ All OAuth providers work correctly
- ✅ Users can register and login
- ✅ Social accounts can be connected
- ✅ Posts can be created and scheduled
- ✅ No critical errors in logs
- ✅ All environment variables are properly configured

## Contact & Support

If you encounter issues:
1. Check Vercel deployment logs
2. Review browser console for errors
3. Verify all checklist items above
4. Check OAuth provider documentation
5. Review application logs in Vercel dashboard
