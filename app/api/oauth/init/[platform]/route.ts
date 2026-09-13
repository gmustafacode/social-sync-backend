
import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getProviderConfig } from "@/lib/oauth";
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { getBaseUrl } from '@/lib/utils';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ platform: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { platform } = await params;

    let body: any = {};
    try {
        body = await request.json();
    } catch (e) { }

    const { accountId } = body;

    let config = getProviderConfig(platform);
    let customClientId = config?.clientId;
    let customClientSecret = config?.clientSecret; // Not used here but fetched for completeness
    let customRedirectUri: string | null = null;

    // Support "Bring Your Own App" (Enterprise Mode)
    if (accountId) {
        const db = (await import('@/lib/db')).default;
        const { decrypt } = await import('@/lib/encryption');

        const account = await db.socialAccount.findUnique({
            where: { id: accountId }
        });

        if (account) {
            // Verify ownership
            if (account.userId !== (session.user as any).id) {
                return NextResponse.json({ error: "Unauthorized account access" }, { status: 403 });
            }

            // Check for custom credentials
            if (account.encryptedClientId) {
                try {
                    customClientId = decrypt(account.encryptedClientId);
                    customRedirectUri = account.customRedirectUri || null;
                } catch (e) {
                    console.error("Failed to decrypt custom credentials for account:", accountId);
                }
            } else if (account.metadata) {
                // Fallback for metadata-stored credentials
                try {
                    const meta = JSON.parse(account.metadata);
                    if (meta.encryptedClientId) {
                        customClientId = decrypt(meta.encryptedClientId);
                        customRedirectUri = meta.customRedirectUri || null;
                    }
                } catch (e) { }
            }
        }
    }

    if (!config || !customClientId) {
        return NextResponse.json({ error: "Unsupported platform or missing configuration" }, { status: 400 });
    }

    // CSRF Protection: Generate state
    const state = crypto.randomBytes(32).toString('hex');

    // Store state, platform, AND accountId in a secure, HTTP-only cookie
    const cookieStore = await cookies();
    cookieStore.set('oauth_state', JSON.stringify({ state, platform, accountId }), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 10, // 10 minutes
        path: '/',
    });

    const paramsObj = new URLSearchParams({
        client_id: customClientId,
        redirect_uri: customRedirectUri || `${getBaseUrl()}/api/oauth/callback`,
        response_type: 'code',
        scope: config.scopes.join(' '),
        state: state,
        access_type: 'offline', // For Google to get refresh token
        prompt: 'consent',     // For Google to ensure refresh token
    });

    // Handle platform-specific quirks
    if (platform === 'x') {
        paramsObj.set('code_challenge', 'challenge'); // Simple challenge for example, should use real PKCE
        paramsObj.set('code_challenge_method', 'plain');
    }

    const authUrl = `${config.authUrl}?${paramsObj.toString()}`;

    return NextResponse.json({ url: authUrl });
}
