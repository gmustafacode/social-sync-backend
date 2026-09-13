import db from './db';
import { inngest } from './inngest/client';

export interface PostRequest {
    userId: string;
    accountId: string;
    platform: string;
    contentType: string;
    contentData: {
        title?: string;
        description: string;
        mediaUrl?: string;
        thumbnailUrl?: string;
    };
    scheduledFor?: Date | null;
    timezone?: string;
    targetType?: string;
    targetId?: string;
    visibility?: string;
}

export class SchedulerService {
    /**
     * Schedules or publishes a post atomically.
     */
    static async schedulePost(req: PostRequest) {
        const { userId, accountId, platform, contentType, contentData, scheduledFor, timezone } = req;
        const normalizedPlatform = platform.toLowerCase();

        // 1. Ownership & Status Verification
        const account = await db.socialAccount.findFirst({
            where: { id: accountId, userId: userId, status: "active" }
        });

        if (!account) {
            throw new Error("Invalid or unauthorized social account.");
        }

        const isScheduled = !!scheduledFor && new Date(scheduledFor) > new Date();
        const scheduleTime = isScheduled ? new Date(scheduledFor!) : new Date();

        // 2. Atomic Transaction
        const result = await db.$transaction(async (tx) => {
            let trackingId = null;

            // Platform-specific tracking (currently only LinkedIn)
            if (normalizedPlatform === 'linkedin') {
                const liPost = await tx.linkedInPost.create({
                    data: {
                        user: { connect: { id: userId } },
                        socialAccount: { connect: { id: accountId } },
                        description: contentData.description,
                        title: contentData.title || null,
                        postType: contentType || "TEXT",
                        mediaUrls: contentData.mediaUrl ? [contentData.mediaUrl] : (contentData.thumbnailUrl ? [contentData.thumbnailUrl] : []),
                        status: isScheduled ? 'SCHEDULED' : 'PENDING',
                        targetType: req.targetType || 'FEED',
                        groupIds: req.targetType === 'GROUP' && req.targetId ? [req.targetId] : [],
                        visibility: req.targetType === 'GROUP' ? 'CONTAINER' : (req.visibility || 'PUBLIC')
                    }
                });
                trackingId = liPost.id;
            }

            // Master Scheduler Entry
            const scheduledPost = await tx.scheduledPost.create({
                data: {
                    userId,
                    socialAccountId: accountId,
                    platform: account.platform,
                    postType: contentType || "TEXT",
                    contentText: contentData.description,
                    mediaUrl: contentData.mediaUrl || contentData.thumbnailUrl || null,
                    targetType: req.targetType || "FEED",
                    targetId: req.targetId || null,
                    scheduledAt: scheduleTime,
                    status: isScheduled ? "pending" : "processing",
                    contentId: trackingId,
                    timezone: timezone || "UTC"
                }
            });

            return { trackingId, scheduledPostId: scheduledPost.id, scheduleTime };
        });

        // 3. Dispatch to Background Engine
        let inngestEventId = null;
        if (!isScheduled) {
            const eventName = normalizedPlatform === 'linkedin' ? "linkedin/post.publish" : "app/post.publish_now";
            try {
                const dispatch = await inngest.send({
                    name: eventName,
                    data: {
                        postId: result.trackingId || result.scheduledPostId,
                        scheduledPostId: result.scheduledPostId,
                        platform: normalizedPlatform
                    },
                    // Idempotency Key to prevent duplicate dispatches in cases of timeout/retry
                    idempotencyKey: `publish-${result.scheduledPostId}-${scheduleTime.getTime()}`
                });
                inngestEventId = dispatch.ids[0];
                console.log(`[SchedulerService] Dispatched ${eventName} for post ${result.scheduledPostId}. EventId: ${inngestEventId}`);
            } catch (dispatchError: any) {
                console.error(`[SchedulerService] CRITICAL: Failed to dispatch Inngest event for post ${result.scheduledPostId}:`, dispatchError.message);
                // Mark post as failed if we can't even dispatch it
                await db.scheduledPost.update({
                    where: { id: result.scheduledPostId },
                    data: { status: 'failed', lastError: `Dispatch Failure: ${dispatchError.message}` }
                }).catch(() => { });
            }
        } else if (isScheduled) {
            // SCHEDULED: Dispatch sleep-until event for precise timing
            const eventName = normalizedPlatform === 'linkedin' ? "linkedin/post.schedule" : "app/post.schedule";
            try {
                const scheduleDispatch = await inngest.send({
                    name: eventName,
                    data: {
                        postId: result.trackingId || result.scheduledPostId,
                        scheduledPostId: result.scheduledPostId,
                        platform: normalizedPlatform,
                        scheduledFor: scheduleTime.toISOString()
                    },
                    idempotencyKey: `schedule-${result.scheduledPostId}-${scheduleTime.getTime()}`
                });
                inngestEventId = scheduleDispatch.ids[0];
                console.log(`[SchedulerService] Dispatched precise schedule event ${eventName} for ${scheduleTime.toISOString()}`);
            } catch (dispatchError: any) {
                console.error(`[SchedulerService] Warning: Failed to dispatch sleep-until event`, dispatchError.message);
            }
        }

        return {
            ...result,
            isScheduled,
            inngestEventId
        };
    }
}
