# LinkedIn Enterprise Connect - Complete Setup Guide

## Overview
This guide walks you through connecting your custom LinkedIn app to SocialyNikara for automated posting and profile management.

## Prerequisites
- A LinkedIn account
- A LinkedIn Page (required to create a LinkedIn app)
- Access to the LinkedIn Developer Portal

---

## Step 1: Create a LinkedIn App

### 1.1 Access the Developer Portal
1. Go to [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps)
2. Click **"Create app"**

### 1.2 Fill in App Details
- **App name**: Choose a name (e.g., "SocialyNikara Automation")
- **LinkedIn Page**: Select or create a LinkedIn Page to associate with your app
- **App logo**: Upload a logo (optional but recommended)
- **Legal agreement**: Check the box to agree to LinkedIn's terms

### 1.3 Create the App
Click **"Create app"** to finalize creation.

### 1.4 Mandatory: Verify App Ownership
**CRITICAL**: Your app **will not work** until it is verified by the LinkedIn Page Administrator.

1. In your App Settings, verify the "Company" section shows "Not Verified".
2. Click **"Verify"**.
3. Click **"Generate URL"**.
4. Open this URL as the Page Administrator (or send it to them).
5. Approve the verification request.
6. **Confirm**: refresh your app settings - it must show **"Verified: [Date]"**.

---

## Step 2: Request Required Products

### 2.1 Navigate to Products Tab
In your app dashboard, click on the **"Products"** tab.

### 2.2 Request Access to Products
You need to request access to these two products:

#### Product 1: Share on LinkedIn
- **Purpose**: Allows posting content to LinkedIn on behalf of users
- **Tier**: Default Tier
- Click **"Request access"** or **"Select"**
- **Status**: Should show as "Approved" (usually instant)

#### Product 2: Sign In with LinkedIn using OpenID Connect
- **Purpose**: Enables authentication and profile access
- **Tier**: Standard Tier
- Click **"Request access"** or **"Select"**
- **Status**: Should show as "Approved" (usually instant)

**Important**: Wait until both products show **"Approved"** status before proceeding.

---

## Step 3: Configure OAuth Settings

### 3.1 Navigate to Auth Tab
In your app dashboard, click on the **"Auth"** tab.

### 3.2 Copy Your Credentials
You'll need these for the connection:

- **Client ID**: Copy this value (e.g., `7764u9ak5vvmvq`)
- **Client Secret**: 
  - Click **"Generate a new Client Secret"** if you don't have one
  - Copy the secret immediately (e.g., `YOUR_CLIENT_SECRET`)
  - **Warning**: You can only see the secret once. Store it securely!

### 3.3 Add Authorized Redirect URL
Scroll down to **"OAuth 2.0 settings"** section:

1. Find **"Authorized redirect URLs for your app"**
2. Click **"Add redirect URL"**
3. Enter: `http://localhost:3000/api/oauth/callback`
   - For production, use: `https://yourdomain.com/api/oauth/callback`
4. Click **"Update"**

**Important**: The redirect URL must match exactly (including http/https, port, and path).

### 3.4 Verify OAuth 2.0 Scopes
In the same Auth tab, scroll to **"OAuth 2.0 scopes"**.

You should see these scopes available:
- ✅ `openid` - Use your name and photo
- ✅ `profile` - Use your name and photo
- ✅ `email` - Use the primary email address
- ✅ `w_member_social` - Create, modify, and delete posts

---

## Step 4: Connect LinkedIn in SocialyNikara

### 4.1 Open the Dashboard
1. Navigate to your SocialyNikara dashboard
2. Go to **"Connect Accounts"** page: `http://localhost:3000/dashboard/connect`

### 4.2 Open LinkedIn Connect Modal
1. Find the **LinkedIn** card
2. Click the **"Connect"** button
3. The **"LinkedIn Enterprise Connect"** modal will appear

### 4.3 Enter Your Credentials
Fill in the form with the credentials from Step 3.2:

- **LinkedIn Client ID**: Paste your Client ID
- **LinkedIn Client Secret**: Paste your Client Secret
- **Authorized Redirect URI**: This is auto-filled (should be `http://localhost:3000/api/oauth/callback`)

### 4.4 Review Instructions
The modal contains:
- Setup instructions (same as this guide)
- Common error troubleshooting tips
- Security acknowledgment checkbox

### 4.5 Acknowledge and Initiate
1. Read the instructions carefully
2. Check the box: **"I acknowledge that I have read the documentation and configured my LinkedIn App correctly"**
3. Click **"Initiate Handshake"**

### 4.6 Authorize on LinkedIn
1. You'll be redirected to LinkedIn's authorization page
2. Review the permissions being requested:
   - Access to your profile information
   - Ability to post on your behalf
3. Click **"Allow"** to grant permissions

### 4.7 Return to Dashboard
1. LinkedIn will redirect you back to SocialyNikara
2. The system will:
   - Exchange the authorization code for access tokens
   - Encrypt and store your tokens securely
   - Fetch your LinkedIn profile information
   - Mark the connection as **"Active"**

---

## Step 5: Verify Connection

### 5.1 Check Connection Status
On the **"Connect Accounts"** page, the LinkedIn card should now show:
- Status: **"Connected"** (green checkmark)
- Your LinkedIn profile name
- Your LinkedIn profile picture

### 5.2 Test Posting (Optional)
1. Go to the **"Create Post"** section
2. Select LinkedIn as a target platform
3. Compose a test post
4. Click **"Schedule"** or **"Post Now"**

---

## Troubleshooting

### Error: `unauthorized_scope_error`
**Cause**: Your LinkedIn app doesn't have the required products approved.

**Solution**:
1. Go to LinkedIn Developer Portal > Your App > Products tab
2. Ensure both "Share on LinkedIn" and "Sign In with LinkedIn using OpenID Connect" show **"Approved"**
3. If showing "Pending", wait for approval (usually instant, but can take up to 24 hours)
4. Try connecting again

### Error: `redirect_uri_mismatch`
**Cause**: The redirect URI doesn't match what's configured in your LinkedIn app.

**Solution**:
1. Go to LinkedIn Developer Portal > Your App > Auth tab
2. Verify `http://localhost:3000/api/oauth/callback` is listed exactly in "Authorized redirect URLs"
3. Check for:
   - Trailing slashes (should NOT have one)
   - Correct protocol (http for localhost, https for production)
   - Correct port number (3000 for local development)
4. Update if needed and try again

### Error: `invalid_client_id` or `invalid_client_secret`
**Cause**: Credentials don't match what's in your LinkedIn app.

**Solution**:
1. Go to LinkedIn Developer Portal > Your App > Auth tab
2. Verify the Client ID matches exactly
3. If Client Secret is wrong:
   - Click "Generate a new Client Secret"
   - Copy the new secret immediately
   - Try connecting again with the new secret

### Error: `access_denied`
**Cause**: You clicked "Cancel" on the LinkedIn authorization page, or your app doesn't have required permissions.

**Solution**:
1. Try the connection process again
2. Click **"Allow"** when LinkedIn asks for permissions
3. Ensure your LinkedIn app has both required products approved

### Connection Shows "Needs Re-authentication"
**Cause**: Your access token has expired or been revoked.

**Solution**:
1. Click the **"Re-authenticate"** button on the LinkedIn card
2. You'll be redirected to LinkedIn to re-authorize
3. Click "Allow" to grant permissions again

---

## Security Best Practices

### 1. Protect Your Client Secret
- Never commit your Client Secret to version control
- Store it in environment variables for production
- Regenerate it if you suspect it's been compromised

### 2. Use HTTPS in Production
- Always use `https://` redirect URIs in production
- Update your LinkedIn app settings when deploying

### 3. Monitor Access
- Regularly check your LinkedIn app's usage in the Developer Portal
- Review connected accounts in your LinkedIn settings
- Revoke access if you no longer use the integration

### 4. Token Management
- SocialyNikara automatically refreshes your access tokens
- Tokens are encrypted using AES-256 before storage
- You'll receive an email notification if re-authentication is needed

---

## Advanced Configuration

### Custom Scopes
If you need additional permissions:
1. Request additional products in LinkedIn Developer Portal
2. Update the scopes in the LinkedIn Connect Modal
3. Re-authenticate to grant new permissions

### Multiple LinkedIn Accounts
You can connect multiple LinkedIn accounts:
1. Each account requires its own LinkedIn app
2. Follow this guide for each account
3. Use different Client IDs and Secrets for each

### Production Deployment
When deploying to production:
1. Update redirect URI in LinkedIn app to your production domain
2. Update `NEXTAUTH_URL` in your `.env` file
3. Ensure SSL certificate is valid
4. Test the connection flow in production

---

## API Reference

### Scopes Used
- `openid` - Required for OpenID Connect authentication
- `profile` - Access to basic profile information (name, photo)
- `email` - Access to primary email address
- `w_member_social` - Permission to create, modify, and delete posts

### Token Expiration
- **Access Token**: Expires after 60 days
- **Refresh Token**: Valid for 1 year
- SocialyNikara automatically refreshes tokens before expiration

### Rate Limits
LinkedIn enforces rate limits on API calls:
- **Posts**: Up to 100 posts per day per user
- **Profile Access**: 100 requests per day per app

---

## Support

### LinkedIn Developer Documentation
- [LinkedIn OAuth 2.0](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authentication)
- [Share on LinkedIn API](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin)
- [Sign In with LinkedIn using OpenID Connect](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2)

### Common Resources
- [LinkedIn Developer Portal](https://www.linkedin.com/developers/)
- [LinkedIn API Support](https://www.linkedin.com/help/linkedin/ask/api)

---

## Changelog

### Version 1.0 (Current)
- Initial LinkedIn Enterprise Connect implementation
- Support for custom LinkedIn apps (Bring Your Own Key)
- Secure credential storage with AES-256 encryption
- Automatic token refresh
- Profile information sync
- Post creation and management

---

**Congratulations!** 🎉 Your LinkedIn account is now connected and ready for automated posting!
