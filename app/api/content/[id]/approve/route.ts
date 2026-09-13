import { NextResponse } from 'next/server'
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import db from "@/lib/db"
import { getNextTriggerTime, ScheduleTrigger } from "@/lib/automation-helper"
import { inngest } from "@/lib/inngest/client"
import { apiResponse, handleApiError } from "@/lib/api-utils"

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    const params = await context.params;
    const contentId = params.id;

    // Check auth
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
        return apiResponse.unauthorized();
    }
    const userId = (session.user as any).id;

    try {
        // Fetch content item
        const queueItem = await db.contentQueue.findUnique({
            where: { id: contentId }
        });

        if (!queueItem || queueItem.userId !== userId) {
            return apiResponse.notFound("Content not found");
        }

        // Fetch user preferences and schedules
        const pref = await db.preference.findUnique({
            where: { userId }
        });

        if (!pref || !pref.postingSchedule) {
            return apiResponse.error("No posting schedule triggers found. Please set them in User Information.", 400);
        }

        const schedule = typeof pref.postingSchedule === 'string'
            ? JSON.parse(pref.postingSchedule)
            : pref.postingSchedule;

        if (!Array.isArray(schedule) || schedule.length === 0) {
            return apiResponse.error("Your posting schedule has no triggers configured.", 400);
        }

        // Calculate next trigger time
        const nextTime = getNextTriggerTime(schedule as ScheduleTrigger[], pref.timezone, new Date());
        if (!nextTime) {
            return apiResponse.error("Could not calculate the next valid schedule time.", 400);
        }

        // Fast-track this post to all preferred platforms
        const platforms = pref.preferredPlatforms || [];
        if (platforms.length === 0) {
            return apiResponse.error("No preferred platforms selected in preferences.", 400);
        }

        const scheduledPosts = [];

        for (const platform of platforms) {
            const socialAccount = await db.socialAccount.findFirst({
                where: { userId, platform, status: 'active' }
            });

            if (!socialAccount) continue;

            let linkedInPostId = null;
            if (platform === 'linkedin') {
                const liPost = await db.linkedInPost.create({
                    data: {
                        userId,
                        socialAccountId: socialAccount.id,
                        postType: 'TEXT',
                        description: queueItem.rawContent || queueItem.summary || "Auto-generated content",
                        targetType: 'Person',
                        visibility: 'PUBLIC',
                        status: 'SCHEDULED',
                        scheduledAt: nextTime
                    }
                });
                linkedInPostId = liPost.id;
            }

            const post = await db.scheduledPost.create({
                data: {
                    userId,
                    socialAccountId: socialAccount.id,
                    platform,
                    postType: queueItem.contentType.toUpperCase(),
                    contentText: queueItem.rawContent || queueItem.summary || "Auto-generated content",
                    targetType: 'Profile',
                    status: 'pending',
                    scheduledAt: nextTime,
                    contentId: linkedInPostId
                }
            });

            scheduledPosts.push(post);

            // Dispatch to Inngest to sleep until nextTime
            const eventName = platform === 'linkedin' ? "linkedin/post.schedule" : "app/post.schedule";
            await inngest.send({
                name: eventName,
                data: {
                    scheduledPostId: post.id,
                    scheduledFor: nextTime.toISOString()
                },
                idempotencyKey: `schedule-${post.id}-${nextTime.getTime()}`
            });
        }

        // Mark the content queue item as approved
        await db.contentQueue.update({
            where: { id: contentId },
            data: { status: 'approved' }
        });

        return apiResponse.success({ success: true, message: `Scheduled on ${platforms.length} platforms for ${nextTime.toLocaleString()}` });

    } catch (e) {
        return handleApiError(e);
    }
}
