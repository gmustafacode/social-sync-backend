import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { apiResponse, handleApiError } from "@/lib/api-utils";

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return apiResponse.unauthorized();
    }

    try {
        const body = await request.json();
        const { accountId, content } = body;

        const account = await db.socialAccount.findUnique({
            where: { id: accountId, userId: (session.user as any).id }
        });

        if (!account) {
            return apiResponse.notFound("Account not found");
        }

        // Decrypt token for operation
        const realToken = decrypt(account.encryptedAccessToken || "");

        console.log(`[POSTING] Platform: ${account.platform} | Token: ${realToken.slice(0, 5)}... | Content: ${content}`);

        // Mock API call to social platform
        // await postToPlatform(account.platform, realToken, content);

        // Record history
        await db.postHistory.create({
            data: {
                user: { connect: { id: (session.user as any).id } },
                platform: account.platform,
                status: "success",
                postId: `ext_${Date.now()}`
            }
        });

        return apiResponse.success({ success: true, message: `Post sent to ${account.platform}` });

    } catch (error: any) {
        return handleApiError(error);
    }
}
