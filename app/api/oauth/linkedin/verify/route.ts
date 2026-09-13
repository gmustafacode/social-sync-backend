
import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";
import { checkLinkedInCapabilities } from "@/lib/linkedin";

export async function POST(request: Request) { // GET could work, but POST implies action "Verify"
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { accountId } = await request.json();

    if (!accountId) {
        return NextResponse.json({ error: "Account ID required" }, { status: 400 });
    }

    const userId = (session.user as any).id;

    try {
        // 1. Fetch Account
        const account = await db.socialAccount.findUnique({
            where: { id: accountId }
        });

        if (!account || account.userId !== userId) {
            return NextResponse.json({ error: "Account not found" }, { status: 404 });
        }

        if (account.platform !== 'linkedin') {
            return NextResponse.json({ error: "Not a LinkedIn account" }, { status: 400 });
        }

        // 2. Decrypt Token
        const accessToken = decrypt(account.encryptedAccessToken || '');
        if (!accessToken) {
            return NextResponse.json({
                error: "No access token found. Please reconnect."
            }, { status: 403 });
        }

        // 3. Run Real API Checks
        const capabilities = await checkLinkedInCapabilities(accessToken);

        // 4. Sync Profile Metadata
        let metadata = {};
        try {
            const { getLinkedInProfile } = await import('@/lib/linkedin-token-validator');
            const profile = await getLinkedInProfile(accessToken);

            metadata = {
                username: profile.email || profile.name,
                name: profile.name,
                picture: profile.picture,
                type: 'linkedin',
                firstName: profile.firstName,
                lastName: profile.lastName,
                source: profile.source
            };
        } catch (e) {
            console.warn("[LinkedIn Verify] Profile sync failed, using existing metadata", e);
            metadata = account.metadata ? JSON.parse(account.metadata) : {};
        }

        // 5. Update Database
        const updatedAccount = await db.socialAccount.update({
            where: { id: accountId },
            data: {
                capabilities: capabilities as any, // Prisma Json handling
                metadata: JSON.stringify(metadata),
                lastVerifiedAt: new Date(),
                status: capabilities.basic_posting ? 'active' : 'restricted' // Update status based on core capability
            }
        });

        return NextResponse.json({
            success: true,
            capabilities,
            metadata,
            lastVerifiedAt: updatedAccount.lastVerifiedAt,
            status: updatedAccount.status
        });

    } catch (error) {
        console.error("Verification failed:", error);
        return NextResponse.json({ error: "Verification failed" }, { status: 500 });
    }
}
