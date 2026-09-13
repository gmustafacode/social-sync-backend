
import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { checkLinkedInCapabilities } from "@/lib/linkedin";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;

    try {
        const account = await db.socialAccount.findFirst({
            where: {
                userId,
                platform: 'linkedin'
            }
        });

        if (!account) {
            return NextResponse.json({ connected: false });
        }

        // Parse metadata
        const metadata = account.metadata ? JSON.parse(account.metadata) : {};

        // Calculate isEnterprise correctly based on credential presence
        const isEnterprise = !!account.encryptedClientId && !!account.encryptedClientSecret;

        return NextResponse.json({
            connected: true,
            id: account.id,
            status: account.status,
            lastVerifiedAt: account.lastVerifiedAt,
            capabilities: account.capabilities,
            isEnterprise,
            metadata: {
                name: metadata.name || metadata.username || 'LinkedIn User',
                image: metadata.picture || metadata.profilePicture || metadata.image || null,
                profileUrl: metadata.profileUrl || `https://www.linkedin.com/in/${metadata.id || ''}`
            }
        });

    } catch (error) {
        console.error("LinkedIn Status Check Failed:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
