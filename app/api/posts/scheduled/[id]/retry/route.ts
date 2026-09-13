import { NextResponse } from 'next/server'
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import db from "@/lib/db"
import { apiResponse, handleApiError } from "@/lib/api-utils"

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    const params = await context.params
    const id = params.id

    const session = await getServerSession(authOptions)
    if (!session) {
        return apiResponse.unauthorized();
    }

    try {
        const userId = (session.user as any).id

        // Find the ScheduledPost and verify ownership
        const post = await db.scheduledPost.findFirst({
            where: { id, userId }
        })

        if (!post) {
            return apiResponse.notFound("Post not found");
        }

        if (post.status === 'PUBLISHED' || post.status === 'published') {
            return apiResponse.error("Post is already published", 400);
        }

        if (post.status === 'CANCELLED' || post.status === 'cancelled') {
            return apiResponse.error("Cancelled posts cannot be retried. Please create a new post.", 400);
        }

        // Reset the ScheduledPost to pending so the scheduler picks it up immediately
        await db.scheduledPost.update({
            where: { id },
            data: {
                status: 'pending',
                scheduledAt: new Date(), // Process immediately
                retryCount: 0,          // Reset retry counter
                lastError: null,
                updatedAt: new Date()
            }
        })

        return apiResponse.success({ success: true, message: "Post queued for retry. It will be processed within 1 minute." });
    } catch (error) {
        return handleApiError(error);
    }
}
