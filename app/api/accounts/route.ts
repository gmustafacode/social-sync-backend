import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import { apiResponse, handleApiError } from "@/lib/api-utils";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return apiResponse.unauthorized();

        const userId = (session.user as any).id;

        const accounts = await db.socialAccount.findMany({
            where: { userId },
            select: {
                id: true,
                platform: true,
                platformAccountId: true,
                status: true,
                connectedAt: true,
                lastVerifiedAt: true,
                metadata: true,
                capabilities: true,
                encryptedClientId: true,
                encryptedClientSecret: true,
            }
        });

        const sanitizedAccounts = accounts.map(account => {
            const isEnterprise = !!account.encryptedClientId && !!account.encryptedClientSecret;
            let metadata = {};
            try {
                metadata = typeof account.metadata === 'string'
                    ? JSON.parse(account.metadata)
                    : (account.metadata || {});
            } catch (e) {
                console.warn(`[API Accounts] Failed to parse metadata for ${account.id}`);
            }

            // Standardize LinkedIn metadata fields
            if (account.platform === 'linkedin') {
                const md = metadata as any;
                md.name = md.name || md.username || 'LinkedIn User';
                md.picture = md.picture || md.profilePicture || null;
            }

            return {
                id: account.id,
                platform: account.platform,
                platformAccountId: account.platformAccountId,
                status: account.status,
                connectedAt: account.connectedAt,
                lastVerifiedAt: account.lastVerifiedAt,
                capabilities: account.capabilities,
                metadata,
                isEnterprise
            };
        });

        return apiResponse.success(sanitizedAccounts);
    } catch (error) {
        return handleApiError(error);
    }
}
