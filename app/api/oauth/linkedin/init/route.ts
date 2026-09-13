
import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { encrypt } from "@/lib/encryption";
import db from "@/lib/db";
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { LinkedInService } from '@/lib/linkedin-service';

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { clientId, clientSecret, redirectUri, scopes, accessToken, refreshToken } = body;

        if (!clientId || !clientSecret || !redirectUri) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const userId = (session.user as any).id;
        console.log(`[DEBUG] LinkedIn Init for userId: ${userId}`);
        const platform = 'linkedin';

        // CASE 1: Direct Token Provided (Enterprise Mode)
        if (accessToken) {
            console.log(`[DEBUG] Direct token provided, verifying...`);
            const liService = new LinkedInService(accessToken);
            try {
                const me = await liService.getMe();
                const platformAccountId = me.id;

                // Check if account already exists
                const existing = await db.socialAccount.findUnique({
                    where: {
                        platform_platformAccountId: {
                            platform: 'linkedin',
                            platformAccountId
                        }
                    }
                });

                if (existing && existing.userId !== userId) {
                    return NextResponse.json({ error: "This LinkedIn account is already connected to another user." }, { status: 400 });
                }

                const metadata = JSON.stringify({
                    username: me.localizedFirstName || me.firstName?.localized?.['en_US'] || 'LinkedIn User',
                    picture: me.profilePicture?.['displayImage~']?.elements?.[0]?.identifiers?.[0]?.identifier || null,
                    firstName: me.localizedFirstName,
                    lastName: me.localizedLastName,
                    enterprise: true
                });

                // Standard LinkedIn access tokens usually last 60 days (5184000 seconds)
                // If we don't have the exact expiry from the handshake, we default to 59 days.
                const accessTokenExpiresAt = new Date(Date.now() + 59 * 24 * 60 * 60 * 1000);

                if (existing) {
                    await db.socialAccount.update({
                        where: { id: existing.id },
                        data: {
                            encryptedAccessToken: encrypt(accessToken),
                            encryptedRefreshToken: refreshToken ? encrypt(refreshToken) : existing.encryptedRefreshToken,
                            encryptedClientId: encrypt(clientId),
                            encryptedClientSecret: encrypt(clientSecret),
                            accessTokenExpiresAt,
                            metadata,
                            status: 'active',
                            lastVerifiedAt: new Date()
                        }
                    });
                } else {
                    await db.socialAccount.create({
                        data: {
                            userId,
                            platform: 'linkedin',
                            platformAccountId,
                            encryptedAccessToken: encrypt(accessToken),
                            encryptedRefreshToken: refreshToken ? encrypt(refreshToken) : null,
                            encryptedClientId: encrypt(clientId),
                            encryptedClientSecret: encrypt(clientSecret),
                            accessTokenExpiresAt,
                            metadata,
                            status: 'active',
                            lastVerifiedAt: new Date(),
                            scopes: JSON.stringify(scopes || [])
                        }
                    });
                }


                return NextResponse.json({ success: true, direct: true });
            } catch (err: any) {
                console.error("LinkedIn Token Verification Failed:", err);
                return NextResponse.json({ error: "Invalid Access Token. Could not verify identity." }, { status: 400 });
            }
        }

        // CASE 2: Standard OAuth Handshake (Keep as fallback or first step)
        // ... (remaining code remains similar but I need to make sure I don't duplicate logic)

        // 1. Create a "pending" social account record with setup status
        // We use a temporary platformAccountId since we don't have the real one yet
        const tempId = `pending_${crypto.randomBytes(8).toString('hex')}`;

        const metadataJson = JSON.stringify({
            encryptedClientId: encrypt(clientId),
            encryptedClientSecret: encrypt(clientSecret),
            customRedirectUri: redirectUri,
            setup: true
        });
        const scopesJson = JSON.stringify(scopes || ['r_verify', 'openid', 'profile', 'w_member_social', 'email', 'r_profile_basicinfo']);

        const account = await db.socialAccount.create({
            data: {
                id: crypto.randomUUID(),
                userId: userId,
                platform: platform,
                platformAccountId: tempId,
                encryptedAccessToken: 'PENDING_HANDSHAKE',
                encryptedClientId: encrypt(clientId),
                encryptedClientSecret: encrypt(clientSecret),
                customRedirectUri: redirectUri,
                metadata: metadataJson,
                scopes: scopesJson,
                status: 'setup'
            }
        });

        // 2. Generate LinkedIn Auth URL
        const state = crypto.randomBytes(32).toString('hex');

        const cookieStore = await cookies();
        cookieStore.set('oauth_state', JSON.stringify({
            state,
            platform,
            accountId: account.id // Track which account record to update
        }), {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 10,
            path: '/',
        });

        const params = new URLSearchParams({
            response_type: 'code',
            client_id: clientId,
            redirect_uri: redirectUri,
            state: state,
            scope: Array.isArray(scopes) ? scopes.join(' ') : 'openid profile email w_member_social',
        });

        const authUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;

        return NextResponse.json({ url: authUrl });

    } catch (error) {
        console.error("LinkedIn Init Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
