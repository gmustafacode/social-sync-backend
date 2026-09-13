import { NextResponse } from 'next/server'
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import db from "@/lib/db"

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    const params = await context.params
    const id = params.id

    const session = await getServerSession(authOptions)
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const userId = (session.user as any).id

        // 1. Find the original LinkedIn post
        const post = await db.linkedInPost.findUnique({
            where: { id, userId },
            include: { socialAccount: true }
        })

        if (!post) {
            return NextResponse.json({ error: "Post not found" }, { status: 404 })
        }

        if (post.status === 'PUBLISHED') {
            return NextResponse.json({ error: "Post is already published" }, { status: 400 })
        }

        // 2. Reset the LinkedInPost status
        await db.linkedInPost.update({
            where: { id },
            data: {
                status: 'PENDING',
                errorMessage: null
            }
        })

        // 3. Find or create a ScheduledPost entry for the cron worker to pick up
        const existingScheduled = await db.scheduledPost.findFirst({
            where: { contentId: id, userId }
        })

        if (existingScheduled) {
            // Reset the existing scheduled post for re-processing
            await db.scheduledPost.update({
                where: { id: existingScheduled.id },
                data: {
                    status: 'pending',
                    scheduledAt: new Date(), // Process immediately
                    updatedAt: new Date()
                }
            })
        } else {
            // Create a new scheduled post entry so the cron worker picks it up
            await db.scheduledPost.create({
                data: {
                    userId,
                    socialAccountId: post.socialAccountId,
                    platform: 'linkedin',
                    postType: post.postType || 'TEXT',
                    contentText: post.description || '',
                    mediaUrl: post.mediaUrls?.[0] || post.thumbnailUrl || null,
                    targetType: post.targetType || 'FEED',
                    targetId: post.groupIds?.[0] || null,
                    scheduledAt: new Date(), // Process immediately
                    status: 'pending',
                    contentId: post.id
                }
            })
        }

        return NextResponse.json({ success: true, message: "Post queued for retry. It will be processed within 1 minute." })
    } catch (error) {
        console.error("Failed to retry post:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}