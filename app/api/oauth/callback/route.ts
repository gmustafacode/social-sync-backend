
import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getProviderConfig } from "@/lib/oauth";
import { encrypt } from "@/lib/encryption";
import db from "@/lib/db";
import { cookies } from 'next/headers';
import { PlatformGuard } from "@/lib/platform-guard";
import { getBaseUrl } from "@/lib/utils";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
        return NextResponse.redirect(`${getBaseUrl()}/dashboard/connect?error=${error}`);
    }

    // 1. Verify state
    const cookieStore = await cookies();
    const oauthCookie = cookieStore.get('oauth_state');
    if (!oauthCookie) {
        return NextResponse.json({ error: "Missing state cookie" }, { status: 400 });
    }

    let storedData;
    try {
        storedData = JSON.parse(oauthCookie.value);
    } catch (e) {
        return NextResponse.json({ error: "Invalid state cookie" }, { status: 400 });
    }

    if (storedData.state !== state) {
        cookieStore.delete('oauth_state');
        return NextResponse.json({ error: "State mismatch (CSRF)" }, { status: 400 });
    }

    // Clear state cookie
    cookieStore.delete('oauth_state');

    const { platform, accountId } = storedData;
    let config = getProviderConfig(platform);
    let customConfig: any = null;
    let customRedirect: string | null = null;

    if (accountId) {
        customConfig = await db.socialAccount.findUnique({ where: { id: accountId } });
        if (customConfig) {
            const { decrypt } = await import('@/lib/encryption');

            // Try to extract from dedicated columns first, fallback to metadata
            let customClientId = customConfig.encryptedClientId;
            let customClientSecret = customConfig.encryptedClientSecret;
            customRedirect = customConfig.customRedirectUri;

            if (!customClientId && customConfig.metadata) {
                try {
                    const meta = JSON.parse(customConfig.metadata);
                    customClientId = meta.encryptedClientId || customClientId;
                    customClientSecret = meta.encryptedClientSecret || customClientSecret;
                    customRedirect = meta.customRedirectUri || customRedirect;
                } catch (e) { }
            }

            if (customClientId && customClientSecret) {
                try {
                    config = {
                        ...config!,
                        clientId: decrypt(customClientId),
                        clientSecret: decrypt(customClientSecret),
                        tokenUrl: config?.tokenUrl || '',
                        id: platform,
                        authUrl: config?.authUrl || '',
                        scopes: config?.scopes || []
                    };
                    (customConfig as any).customRedirectUri = customRedirect; // For later use in redirect
                } catch (decryptError: any) {
                    console.error(`[OAuth Callback] Failed to decrypt enterprise credentials for ${accountId}:`, decryptError.message);
                    // Fall back to global config - don't crash the OAuth flow
                    // The account will be updated with new tokens using global config
                }
            }
        }
    }

    if (!config) {
        return NextResponse.json({ error: "Unsupported platform or missing config" }, { status: 400 });
    }

    // 2. Exchange code for tokens
    try {
        const redirectUri = customRedirect || `${getBaseUrl()}/api/oauth/callback`;
        console.log(`[OAuth Debug] Exchanging code for ${platform}. ClientID prefix: ${config.clientId?.substring(0, 5)}... RedirectURI: ${redirectUri}`);

        const tokenResponse = await fetch(config.tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: config.clientId,
                client_secret: config.clientSecret,
                code: code!,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri,
            }),
            signal: AbortSignal.timeout(20000)
        });

        const tokens = await tokenResponse.json();

        if (!tokenResponse.ok) {
            console.error("Token exchange failed:", tokens);
            return NextResponse.json({ error: "Token exchange failed", details: tokens }, { status: 500 });
        }

        // PlatformGuard check moved down after profile fetch to allow re-authentication of the same account.

        // 3. Fetch Platform Account ID & Metadata (Platform specific) Standardized
        let platformAccountId = "";
        let metadata: any = {};

        if (platform === 'google') {
            const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${tokens.access_token}` },
                signal: AbortSignal.timeout(15000)
            });
            const profile = await profileRes.json();
            platformAccountId = profile.id;
            metadata = {
                username: profile.email,
                name: profile.name,
                picture: profile.picture,
                type: 'google'
            };
        } else if (platform === 'x') {
            const profileRes = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url', {
                headers: { Authorization: `Bearer ${tokens.access_token}` },
                signal: AbortSignal.timeout(15000)
            });
            const profile = await profileRes.json();
            platformAccountId = profile.data.id;
            metadata = {
                username: profile.data.username,
                name: profile.data.name,
                picture: profile.data.profile_image_url,
                type: 'x'
            };
        } else if (platform === 'instagram') {
            // Instagram Graph API logic: 
            // 1. Get user pages
            // 2. Find page with linked IG account
            const pagesRes = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${tokens.access_token}`, {
                signal: AbortSignal.timeout(15000)
            });
            const pagesData = await pagesRes.json();

            // For simplicity, take the first page that has an IG Business Account
            for (const page of pagesData.data || []) {
                const igRes = await fetch(`https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account&access_token=${tokens.access_token}`, {
                    signal: AbortSignal.timeout(15000)
                });
                const igData = await igRes.json();

                if (igData.instagram_business_account) {
                    platformAccountId = igData.instagram_business_account.id;
                    const igProfileRes = await fetch(`https://graph.facebook.com/v18.0/${platformAccountId}?fields=username,name,profile_picture_url&access_token=${tokens.access_token}`, {
                        signal: AbortSignal.timeout(15000)
                    });
                    const igProfile = await igProfileRes.json();

                    metadata = {
                        username: igProfile.username,
                        name: igProfile.name,
                        picture: igProfile.profile_picture_url,
                        pageId: page.id,
                        type: 'instagram'
                    };
                    break;
                }
            }
        } else if (platform === 'linkedin') {
            const { getLinkedInProfile } = await import('@/lib/linkedin-token-validator');
            const profile = await getLinkedInProfile(tokens.access_token);

            // Use full URN for platformAccountId if available, otherwise construct it
            platformAccountId = profile.id.startsWith('urn:li:')
                ? profile.id
                : `${(profile as any).suggestedUrnPrefix || 'urn:li:person:'}${profile.id}`;

            metadata = {
                username: profile.email || profile.name,
                name: profile.name,
                picture: profile.picture,
                type: 'person', // These endpoints are for personal profiles
                firstName: profile.firstName,
                lastName: profile.lastName,
                source: profile.source
            };
        }
        else if (platform === 'reddit') {
            const profileRes = await fetch('https://oauth.reddit.com/api/v1/me', {
                headers: { Authorization: `Bearer ${tokens.access_token}` },
                signal: AbortSignal.timeout(15000)
            });
            const profile = await profileRes.json();
            platformAccountId = profile.id;
            metadata = {
                username: profile.name,
                picture: profile.icon_img,
                type: 'reddit'
            };
        }

        // CRITICAL: Check if user can attach this platform (one account per platform rule)
        // Now that we have the platformAccountId, we can allow re-authentication of the SAME physical account.
        const userId = (session.user as any).id;
        const existingAccount = await db.socialAccount.findUnique({
            where: {
                user_platform_unique: {
                    userId,
                    platform
                }
            }
        });

        if (existingAccount && existingAccount.platformAccountId !== platformAccountId) {
            const guardCheck = await PlatformGuard.canAttachPlatform(userId, platform);
            if (!guardCheck.allowed) {
                console.warn(`[OAuth] Platform attachment blocked for user ${userId}, platform ${platform}. Tried to connect different account: ${platformAccountId}`);
                return NextResponse.redirect(
                    `${getBaseUrl()}/dashboard/connect?error=platform_already_connected&platform=${platform}&message=${encodeURIComponent(guardCheck.reason || '')}`
                );
            }
        }

        // 4. Encrypt and Save to DB
        // userId already declared above for PlatformGuard check

        // Merge metadata if it's an enterprise account to preserve credentials in fallback storage
        let finalMetadata = { ...metadata };
        if (customConfig && customConfig.metadata) {
            try {
                const existingMeta = JSON.parse(customConfig.metadata);
                if (existingMeta.encryptedClientId) {
                    finalMetadata = { ...existingMeta, ...finalMetadata };
                }
            } catch (e) { }
        }

        const updateData = {
            platformAccountId,
            encryptedAccessToken: encrypt(tokens.access_token),
            encryptedRefreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined,
            accessTokenExpiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
            scopes: JSON.stringify(tokens.scope || config.scopes),
            metadata: JSON.stringify(finalMetadata),
            status: "active",
            lastVerifiedAt: new Date(),
        };

        if (accountId) {
            // Check for conflict: If the platform account already exists (linked to this or another user)
            // we need to resolve it. Since we are in a "link" flow initiated by the current user,
            // and we created a 'pending' record (accountId) for this flow, we should prioritize the CURRENT flow.
            // If an old record exists, we remove it to allow the new one to take its place.
            const existing = await db.socialAccount.findUnique({
                where: {
                    platform_platformAccountId: {
                        platform: platform,
                        platformAccountId: platformAccountId,
                    }
                }
            });

            // CRITICAL SECURITY FIX: Prevent stealing or silent updates of other users' accounts
            if (existing && existing.userId !== userId) {
                console.warn(`[OAuth] Blocked attempt to connect account ${platformAccountId} (User ${userId}) which is already owned by User ${existing.userId}`);
                return NextResponse.redirect(
                    `${getBaseUrl()}/dashboard/connect?error=account_already_linked&platform=${platform}&message=${encodeURIComponent('This account is already connected to another user.')}`
                );
            }

            if (existing && existing.id !== accountId) {
                console.log(`[OAuth] Resolving conflict: Deactivating old account ${existing.id} for platform ${platform}`);
                // Use a transaction to ensure both updates happen atomically
                await db.$transaction([
                    db.socialAccount.update({
                        where: { id: existing.id },
                        data: { status: 'archived', platformAccountId: `${existing.platformAccountId}_archived_${Date.now()}` }
                    }),
                    db.socialAccount.update({
                        where: { id: accountId },
                        data: updateData,
                    })
                ]);
            } else {
                await db.socialAccount.update({
                    where: { id: accountId },
                    data: updateData,
                });
            }
        } else {
            // No pending accountId (e.g. initial connect flow)
            // Check if this platform account exists
            const existing = await db.socialAccount.findUnique({
                where: {
                    platform_platformAccountId: {
                        platform: platform,
                        platformAccountId: platformAccountId,
                    }
                }
            });

            if (existing) {
                if (existing.userId !== userId) {
                    // Block cross-user connection
                    console.warn(`[OAuth] Blocked attempt to connect account ${platformAccountId} (User ${userId}) which is already owned by User ${existing.userId}`);
                    return NextResponse.redirect(
                        `${getBaseUrl()}/dashboard/connect?error=account_already_linked&platform=${platform}&message=${encodeURIComponent('This account is already connected to another user.')}`
                    );
                } else {
                    // Same user, update tokens
                    await db.socialAccount.update({
                        where: { id: existing.id },
                        data: updateData
                    });
                }
            } else {
                // Create new
                await db.socialAccount.create({
                    data: {
                        userId,
                        platform,
                        ...updateData,
                    }
                });
            }
        }

        return NextResponse.redirect(`${getBaseUrl()}/dashboard/connect?success=true&platform=${platform}`);

    } catch (e: any) {
        console.error("OAuth callback error:", e);
        return NextResponse.redirect(`${getBaseUrl()}/dashboard/connect?error=internal_server_error&message=${encodeURIComponent(e.message || 'Unknown error occurred')}`);
    }
}
