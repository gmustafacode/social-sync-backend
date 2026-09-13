
export interface OAuthProviderConfig {
    id: string;
    clientId: string;
    clientSecret: string;
    authUrl: string;
    tokenUrl: string;
    scopes: string[];
    extraParams?: Record<string, string>;
}

const getOAuthConfig = (id: string): OAuthProviderConfig => {
    const config = OAUTH_PROVIDERS[id];
    if (!config) throw new Error(`OAuth provider ${id} not found`);

    // Validate required env vars only when accessed
    if (!config.clientId || !config.clientSecret) {
        throw new Error(`CRITICAL: Missing environment variables for OAuth provider ${id}. Please set ${id.toUpperCase()}_CLIENT_ID and ${id.toUpperCase()}_CLIENT_SECRET.`);
    }

    return config;
};

export const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
    google: {
        id: 'google',
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        scopes: [
            'https://www.googleapis.com/auth/youtube.readonly',
            'https://www.googleapis.com/auth/youtube.upload',
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/userinfo.email',
            'openid'
        ],
        extraParams: {
            access_type: 'offline',
            prompt: 'consent'
        }
    },

    linkedin: {
        id: 'linkedin',
        clientId: process.env.LINKEDIN_CLIENT_ID || '',
        clientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
        authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
        tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
        scopes: [
            'openid',
            'profile',
            'email',
            'w_member_social'
        ]
    },
    x: {
        id: 'x',
        clientId: process.env.X_CLIENT_ID || '',
        clientSecret: process.env.X_CLIENT_SECRET || '',
        authUrl: 'https://twitter.com/i/oauth2/authorize',
        tokenUrl: 'https://api.twitter.com/2/oauth2/token',
        scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access']
    },
    instagram: {
        id: 'instagram',
        clientId: process.env.INSTAGRAM_CLIENT_ID || '',
        clientSecret: process.env.INSTAGRAM_CLIENT_SECRET || '',
        authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
        tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
        scopes: ['instagram_basic', 'instagram_content_publish', 'pages_show_list', 'pages_read_engagement', 'public_profile']
    },
    tiktok: {
        id: 'tiktok',
        clientId: process.env.TIKTOK_CLIENT_ID || '',
        clientSecret: process.env.TIKTOK_CLIENT_SECRET || '',
        authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
        tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
        scopes: ['user.info.basic', 'video.upload', 'video.publish']
    },
    reddit: {
        id: 'reddit',
        clientId: process.env.REDDIT_CLIENT_ID || '',
        clientSecret: process.env.REDDIT_CLIENT_SECRET || '',
        authUrl: 'https://www.reddit.com/api/v1/authorize',
        tokenUrl: 'https://www.reddit.com/api/v1/access_token',
        scopes: ['identity', 'submit', 'history'],
        extraParams: {
            duration: 'permanent'
        }
    },
    medium: {
        id: 'medium',
        clientId: process.env.MEDIUM_CLIENT_ID || '',
        clientSecret: process.env.MEDIUM_CLIENT_SECRET || '',
        authUrl: 'https://medium.com/m/oauth/authorize',
        tokenUrl: 'https://api.medium.com/v1/tokens',
        scopes: ['basicProfile', 'publishPost']
    }
};

import { encrypt, decrypt } from './encryption';
import db from './db';
import { sendMail } from './mail';

export async function refreshAccessToken(accountId: string) {
    const account = await db.socialAccount.findUnique({
        where: { id: accountId }
    });

    if (!account || !account.encryptedRefreshToken) return null;

    // Concurrency Guard: If token was updated in the last 30 seconds, assume another process just refreshed it.
    // This prevents race conditions where multiple parallel jobs try to refresh the same token.
    const timeSinceLastUpdate = Date.now() - new Date(account.updatedAt).getTime();
    if (timeSinceLastUpdate < 30 * 1000) {
        // Return current access token
        console.log(`[OAuth] concurrent refresh detected for ${accountId}, returning current token.`);
        try {
            return account.encryptedAccessToken ? decrypt(account.encryptedAccessToken) : null;
        } catch (decryptError: any) {
            console.error(`[OAuth] Decryption failed for concurrent refresh ${accountId}:`, decryptError.message);
            // Mark as revoked if we can't decrypt - likely key rotation or corruption
            await db.socialAccount.update({
                where: { id: accountId },
                data: { status: 'revoked', metadata: JSON.stringify({ decryptionError: decryptError.message }) }
            });
            return null;
        }
    }

    let { clientId, clientSecret, tokenUrl } = OAUTH_PROVIDERS[account.platform.toLowerCase()] || {};

    // Prioritize direct model fields (Enterprise Mode)
    if (account.encryptedClientId && account.encryptedClientSecret) {
        try {
            clientId = decrypt(account.encryptedClientId);
            clientSecret = decrypt(account.encryptedClientSecret);
        } catch (decryptError: any) {
            console.error(`[OAuth Refresh] Failed to decrypt enterprise credentials for ${accountId}:`, decryptError.message);
            // Fall through to try global config
            clientId = '';
            clientSecret = '';
        }
        // tokenUrl remains from config, or could be stored too.
    }

    // Fallback to global config if enterprise decrypt failed or not set
    if (!clientId || !clientSecret) {
        try {
            const config = getOAuthConfig(account.platform.toLowerCase());
            clientId = config.clientId;
            clientSecret = config.clientSecret;
            tokenUrl = config.tokenUrl;
        } catch (e: any) {
            console.error(`[OAuth Refresh] Config error for ${account.platform}: ${e.message}`);
            return null;
        }
    }

    try {
        let refreshToken: string;
        try {
            refreshToken = decrypt(account.encryptedRefreshToken);
        } catch (decryptError: any) {
            console.error(`[OAuth Refresh] Failed to decrypt refresh token for ${accountId}:`, decryptError.message);
            // CRITICAL: If we can't decrypt the refresh token, the account is unusable
            await db.socialAccount.update({
                where: { id: accountId },
                data: {
                    status: 'revoked',
                    metadata: JSON.stringify({
                        decryptionError: decryptError.message,
                        timestamp: new Date().toISOString()
                    })
                }
            });

            // Notify user
            const user = await db.user.findUnique({ where: { id: account.userId } });
            if (user?.email) {
                await sendMail({
                    to: user.email,
                    subject: `Action Required: Reconnect your ${account.platform} account`,
                    text: `Your ${account.platform} connection has been revoked due to a security key rotation. Please reconnect it in your dashboard to continue using automated posting.`
                });
            }
            return null;
        }

        let tokenResponse;
        try {
            tokenResponse = await fetch(tokenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: clientId,
                    client_secret: clientSecret,
                    refresh_token: refreshToken,
                    grant_type: 'refresh_token',
                }),
                signal: AbortSignal.timeout(20000) // 20s timeout
            });
        } catch (fetchError: any) {
            console.error(`[OAuth Refresh] Fetch error for account ${accountId}:`, fetchError.message);
            return null; // Don't revoke on temporary network issues
        }

        let data: any;
        try {
            const text = await tokenResponse.text();
            data = text ? JSON.parse(text) : {};
        } catch (e) {
            data = { error: "parse_error", message: "Invalid JSON response" };
        }

        if (!tokenResponse.ok) {
            console.error(`[OAuth Refresh] API Failed for account ${accountId} (${account.platform}):`, {
                status: tokenResponse.status,
                error: data
            });

            // Handle specific rotation or invalid_grant errors
            if (data.error === 'invalid_grant' || tokenResponse.status === 401 || tokenResponse.status === 400) {
                await db.socialAccount.update({
                    where: { id: accountId },
                    data: {
                        status: 'revoked',
                        metadata: JSON.stringify({ lastRefreshError: data })
                    }
                });
            }
            return null;
        }

        const updatedAccount = await db.socialAccount.update({
            where: { id: accountId },
            data: {
                encryptedAccessToken: encrypt(data.access_token),
                encryptedRefreshToken: data.refresh_token ? encrypt(data.refresh_token) : account.encryptedRefreshToken,
                accessTokenExpiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : account.accessTokenExpiresAt,
                lastVerifiedAt: new Date(),
                status: 'active'
            }
        });

        // Add null check since encryptedAccessToken can be null
        return updatedAccount.encryptedAccessToken ? decrypt(updatedAccount.encryptedAccessToken) : null;

    } catch (error) {
        console.error("Token refresh failed:", error);
        return null;
    }
}

export async function getValidAccessToken(accountId: string) {
    const account = await db.socialAccount.findUnique({
        where: { id: accountId }
    });

    if (!account) return null;
    if (account.status !== 'active') {
        console.warn(`[OAuth] Token requested for inactive account ${accountId} (Status: ${account.status}). Denied.`);
        return null;
    }


    // Proactive Refresh: Check if expires within 5 minutes
    const buffer = 5 * 60 * 1000;
    if (account.accessTokenExpiresAt && account.accessTokenExpiresAt.getTime() - Date.now() < buffer) {
        return refreshAccessToken(accountId);
    }

    if (!account.encryptedAccessToken) return null;

    try {
        return decrypt(account.encryptedAccessToken);
    } catch (decryptError: any) {
        console.error(`[OAuth] Failed to decrypt access token for ${accountId}:`, decryptError.message);
        // Mark account as needing re-authentication
        await db.socialAccount.update({
            where: { id: accountId },
            data: { status: 'revoked' }
        });
        return null;
    }
}

export function getProviderConfig(platform: string): OAuthProviderConfig | null {
    return OAUTH_PROVIDERS[platform.toLowerCase()] || null;
}
