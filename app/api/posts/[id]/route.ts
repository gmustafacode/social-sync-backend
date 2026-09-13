import { NextResponse } from 'next/server'
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import db from "@/lib/db"
import { apiResponse, handleApiError } from "@/lib/api-utils"

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
    const params = await context.params
    const id = params.id

    const session = await getServerSession(authOptions)
    if (!session) {
        return apiResponse.unauthorized();
    }

    const userId = (session.user as any).id

    try {
        // Find the scheduled post and verify ownership
        const post = await db.scheduledPost.findFirst({
            where: { id, userId }
        })

        if (!post) {
            return apiResponse.notFound("Post not found");
        }

        // Only allow cancellation of pending/scheduled posts
        if (!['pending', 'PENDING', 'SCHEDULED', 'scheduled'].includes(post.status)) {
            return apiResponse.error(`Cannot cancel a post with status "${post.status}". Only pending or scheduled posts can be cancelled.`, 400);
        }

        // Update the scheduled post status  
        await db.scheduledPost.update({
            where: { id },
            data: {
                status: 'CANCELLED',
                updatedAt: new Date()
            }
        })

        // Also update the linked content record if it exists
        if (post.contentId) {
            // Try LinkedInPost first
            try {
                await db.linkedInPost.update({
                    where: { id: post.contentId },
                    data: { status: 'CANCELLED' }
                })
            } catch {
                // May not be a LinkedInPost, try ContentQueue
                try {
                    await db.contentQueue.update({
                        where: { id: post.contentId },
                        data: { status: 'cancelled' }
                    })
                } catch {
                    // Content record may have been deleted or doesn't exist
                }
            }
        }

        return apiResponse.success({ success: true, message: "Post cancelled successfully" });
    } catch (error) {
        return handleApiError(error);
    }
}
