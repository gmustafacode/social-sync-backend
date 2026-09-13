# LinkedIn Integration - Technical Implementation Summary

## Architecture Overview

The LinkedIn integration uses a **"Bring Your Own Key" (BYOK)** model, allowing users to connect their own LinkedIn apps for maximum security and control.

### Key Components

1. **Frontend Modal** (`components/LinkedInConnectModal.tsx`)
   - Interactive form for credential input
   - Inline documentation and error guides
   - Security acknowledgment checkbox
   - SSR-safe (handles `window` object properly)

2. **Initiation Endpoint** (`app/api/oauth/linkedin/init/route.ts`)
   - Validates user session
   - Encrypts and stores credentials in database
   - Generates LinkedIn OAuth authorization URL
   - Uses raw SQL to bypass Prisma Client validation issues.
   
3. **Callback Endpoint** (`app/api/oauth/callback/route.ts`)
   - Handles OAuth code exchange
   - Supports both standard and custom app configurations
   - Fetches profile data from LinkedIn
   - Stores encrypted tokens and metadata
   - Merges enterprise credentials during updates

4. **Token Refresh Utility** (`lib/oauth.ts`)
   - Automatically refreshes expired tokens
   - Supports custom enterprise credentials
   - Handles revocation and user notifications

## Database Schema

```prisma
model SocialAccount {
  id                    String    @id @default(uuid())
  userId                String
  platform              String
  platformAccountId     String?
  encryptedAccessToken  String?
  encryptedRefreshToken String?
  encryptedClientId     String?   // For enterprise apps
  encryptedClientSecret String?   // For enterprise apps
  customRedirectUri     String?   // Custom redirect for user's app
  expiresAt             DateTime?
  scopes                String?   // JSON string
  metadata              String?   // JSON string (profile, credentials fallback)
  status                String    @default("active") // active, revoked, expired, setup
  connectedAt           DateTime  @default(now())
  lastVerifiedAt        DateTime?
  updatedAt             DateTime  @updatedAt
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([platform, platformAccountId])
  @@map("social_accounts")
}
```

## Security Features

### 1. Encryption
- **Algorithm**: AES-256-CBC
- **Encrypted Fields**:
  - Access tokens
  - Refresh tokens
  - Client IDs (for enterprise apps)
  - Client Secrets (for enterprise apps)
- **Key Storage**: Environment variable (`ENCRYPTION_KEY`)

### 2. State Management
- CSRF protection using cryptographic state tokens
- State stored in HTTP-only cookies
- 10-minute expiration on state cookies

### 3. Credential Storage
- Primary: Dedicated columns (`encryptedClientId`, `encryptedClientSecret`)
- Fallback: JSON metadata field (for Prisma Client compatibility)
- Automatic merging during profile updates

## OAuth Flow

### Standard Flow (Non-Enterprise)
```
User clicks "Connect LinkedIn"
  ↓
Redirect to LinkedIn OAuth
  ↓
User authorizes
  ↓
LinkedIn redirects to callback with code
  ↓
Exchange code for tokens
  ↓
Fetch profile data
  ↓
Store encrypted tokens
  ↓
Mark as "active"
```

### Enterprise Flow (BYOK)
```
User clicks "Connect LinkedIn"
  ↓
Modal opens for credential input
  ↓
User enters Client ID, Secret, Redirect URI
  ↓
System creates "setup" record with encrypted credentials
  ↓
Generate OAuth URL with custom credentials
  ↓
Redirect to LinkedIn OAuth
  ↓
User authorizes
  ↓
LinkedIn redirects to callback with code
  ↓
Retrieve custom credentials from setup record
  ↓
Exchange code for tokens using custom credentials
  ↓
Fetch profile data
  ↓
Update record: merge credentials + profile + tokens
  ↓
Mark as "active"
```

## API Endpoints

### POST `/api/oauth/linkedin/init`
Initiates LinkedIn OAuth flow with custom credentials.

**Request Body**:
```json
{
  "clientId": "7764u9ak5vvmvq",
  "clientSecret": "YOUR_CLIENT_SECRET",
  "redirectUri": "http://localhost:3000/api/oauth/callback",
  "scopes": ["openid", "profile", "email", "w_member_social"]
}
```

**Response**:
```json
{
  "url": "https://www.linkedin.com/oauth/v2/authorization?..."
}
```

**Database Operation**:
```sql
INSERT INTO "social_accounts" (
    id, "userId", platform, "platformAccountId", 
    "encryptedAccessToken", metadata, scopes, status, 
    "connectedAt", "updatedAt"
) VALUES (
    uuid, userId, 'linkedin', 'pending_xxx',
    'PENDING_HANDSHAKE', 
    '{"encryptedClientId":"...","encryptedClientSecret":"..."}',
    '["openid","profile","email","w_member_social"]',
    'setup',
    NOW(), NOW()
)
```

### GET `/api/oauth/callback`
Handles OAuth callback and token exchange.

**Query Parameters**:
- `code`: Authorization code from LinkedIn
- `state`: CSRF protection token
- `error`: Error code (if authorization failed)

**Process**:
1. Validate state (CSRF protection)
2. Retrieve custom credentials if `accountId` exists
3. Exchange code for tokens
4. Fetch profile data from LinkedIn
5. Encrypt and store tokens
6. Update account status to "active"

## LinkedIn API Integration

### Endpoints Used

#### 1. Authorization
```
GET https://www.linkedin.com/oauth/v2/authorization
```
**Parameters**:
- `response_type=code`
- `client_id={clientId}`
- `redirect_uri={redirectUri}`
- `state={state}`
- `scope=openid profile email w_member_social`

#### 2. Token Exchange
```
POST https://www.linkedin.com/oauth/v2/accessToken
```
**Body**:
- `client_id={clientId}`
- `client_secret={clientSecret}`
- `code={code}`
- `grant_type=authorization_code`
- `redirect_uri={redirectUri}`

**Response**:
```json
{
  "access_token": "...",
  "expires_in": 5184000,
  "refresh_token": "...",
  "refresh_token_expires_in": 31536000,
  "scope": "openid profile email w_member_social"
}
```

#### 3. Profile Data (OpenID Connect)
```
GET https://api.linkedin.com/v2/userinfo
Authorization: Bearer {access_token}
```

**Response**:
```json
{
  "sub": "unique_user_id",
  "name": "John Doe",
  "email": "john@example.com",
  "picture": "https://..."
}
```

**Fallback** (Legacy API):
```
GET https://api.linkedin.com/v2/me
Authorization: Bearer {access_token}
```

**Response**:
```json
{
  "id": "unique_user_id",
  "localizedFirstName": "John",
  "localizedLastName": "Doe",
  "profilePicture": {...}
}
```

#### 4. Token Refresh
```
POST https://www.linkedin.com/oauth/v2/accessToken
```
**Body**:
- `client_id={clientId}`
- `client_secret={clientSecret}`
- `refresh_token={refreshToken}`
- `grant_type=refresh_token`

## Scopes

### Required Products
1. **Share on LinkedIn** (Default Tier)
   - Scope: `w_member_social`
   - Permissions: Create, modify, delete posts

2. **Sign In with LinkedIn using OpenID Connect** (Standard Tier)
   - Scopes: `openid`, `profile`, `email`
   - Permissions: Authentication, profile access

### Scope Descriptions
- `openid` - Required for OpenID Connect authentication
- `profile` - Access to name, photo, profile URL
- `email` - Access to primary email address
- `w_member_social` - Permission to post content

## Error Handling

### Common Errors

#### 1. `unauthorized_scope_error`
**Cause**: Requesting scopes not approved for the app
**Handling**: 
- Display error message to user
- Provide link to LinkedIn Developer Portal
- Suggest checking product approvals

#### 2. `redirect_uri_mismatch`
**Cause**: Redirect URI doesn't match app settings
**Handling**:
- Display error with exact URI expected
- Provide instructions to update app settings

#### 3. `invalid_client_id` / `invalid_client_secret`
**Cause**: Credentials don't match
**Handling**:
- Prompt user to re-enter credentials
- Suggest regenerating Client Secret

#### 4. Token Refresh Failure
**Cause**: Refresh token expired or revoked
**Handling**:
- Update account status to "revoked"
- Send email notification to user
- Display "Needs Re-authentication" in UI

## Prisma Client Workarounds

### Issue
During development, the Prisma Client can become out of sync with the database schema when the dev server is running, causing validation errors.

### Solutions Implemented

#### 1. Type Assertions
```typescript
await (db.socialAccount as any).create({...})
```

#### 2. Raw SQL Queries
```typescript
await db.$executeRaw`
  INSERT INTO "social_accounts" (...)
  VALUES (...)
`
```

#### 3. Metadata Fallback
Store enterprise credentials in the `metadata` JSON field as a fallback:
```typescript
metadata: JSON.stringify({
  encryptedClientId: encrypt(clientId),
  encryptedClientSecret: encrypt(clientSecret),
  customRedirectUri: redirectUri,
  setup: true
})
```

#### 4. Smart Retrieval
```typescript
// Try dedicated columns first
let customClientId = customConfig.encryptedClientId;

// Fallback to metadata
if (!customClientId && customConfig.metadata) {
  const meta = JSON.parse(customConfig.metadata);
  customClientId = meta.encryptedClientId;
}
```

## Testing Checklist

### Pre-Connection
- [ ] LinkedIn app created
- [ ] Both products approved
- [ ] Redirect URI configured
- [ ] Client ID and Secret copied

### Connection Flow
- [ ] Modal opens successfully
- [ ] Credentials can be entered
- [ ] Acknowledgment checkbox works
- [ ] "Initiate Handshake" redirects to LinkedIn
- [ ] LinkedIn authorization page loads
- [ ] User can click "Allow"
- [ ] Redirects back to dashboard
- [ ] Connection shows as "Active"

### Post-Connection
- [ ] Profile name displayed
- [ ] Profile picture displayed
- [ ] Can create test post
- [ ] Token refresh works
- [ ] Re-authentication flow works

## Performance Considerations

### Database Queries
- Use indexes on `userId` and `platform` for fast lookups
- Unique constraint on `[platform, platformAccountId]` prevents duplicates

### Token Management
- Proactive refresh before expiration (automation worker)
- Cached decryption results (if needed for high-volume posting)

### Connection Pooling
- Supabase connection pooler (PGBouncer)
- Connection limit: 10 (configurable in `.env`)

## Future Enhancements

### Planned Features
1. **Multi-account support** - Connect multiple LinkedIn profiles per user
2. **Advanced scopes** - Support for `r_verify`, `r_profile_basicinfo`
3. **Analytics integration** - Fetch post engagement metrics
4. **Webhook support** - Real-time notifications for post interactions
5. **Bulk operations** - Schedule multiple posts at once

### Potential Improvements
- Automatic scope detection based on approved products
- Visual scope selector in modal
- Connection health monitoring dashboard
- Automatic re-authentication flow

---

**Last Updated**: February 6, 2026
**Version**: 1.0.0