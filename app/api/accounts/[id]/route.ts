
import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const userId = (session.user as any).id;

    try {
        // Enforce ownership: Only delete if the account belongs to the session user
        const account = await db.socialAccount.findFirst({
            where: { id, userId }
        });

        if (!account) {
            return NextResponse.json({ error: "Account not found or unauthorized" }, { status: 404 });
        }

        // Transaction to ensure data cleanliness
        await db.$transaction([
            // 1. Mark LinkedIn Specific Posts as CANCELLED (Optional, but good for history if not cascading)
            db.linkedInPost.updateMany({
                where: { socialAccountId: id, status: { in: ['SCHEDULED', 'DRAFT'] } },
                data: { status: 'FAILED', errorMessage: 'Account disconnected by user' }
            }),

            // 2. Delete the social account (Cascades to LinkedInPost, ScheduledPost, etc.)
            db.socialAccount.delete({
                where: { id }
            })
        ]);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Disconnect error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
