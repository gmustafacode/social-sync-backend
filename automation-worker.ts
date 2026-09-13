import 'dotenv/config';
import db from './lib/db';
import cron from 'node-cron';
import { LinkedInPostingService } from './lib/linkedin-posting-service';
import { getValidAccessToken } from './lib/oauth';
import { getBaseUrl } from './lib/utils';
import { checkPostingLimits } from './lib/limits';
import { inngest } from './lib/inngest/client';

/**
 * SOCIALSYNCARA BACKEND CRON WORKER (v3 - Database Driven)
 * 
 * Objectives:
 * 1. Process scheduled posts from DB.
 * 2. Distributed safety via SELECT FOR UPDATE SKIP LOCKED.
 * 3. Support retries with exponential-ish logic (simple count for now).
 * 4. Comprehensive execution logging.
 */

let isRunning = false;
let consecutiveDbFailures = 0;
const MAX_SKIP_FAILURES = 5; // After 5 consecutive DB failures, start skipping cycles

/**
 * Quick DB health check with a 10-second timeout.
 * Returns true if DB is reachable, false otherwise.
 */
async function isDbReachable(): Promise<boolean> {
    try {
        await Promise.race([
            db.$queryRaw`SELECT 1`,
            new Promise((_, reject) => setTimeout(() => reject(new Error('DB health check timeout')), 5000))
        ]);
        return true;
    } catch {
        return false;
    }
}

/**
 * Resets jobs that have been stuck in 'processing' for too long.
 */
async function recoverStaleJobs() {
    try {
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

        const stuckPosts = await db.scheduledPost.updateMany({
            where: {
                status: 'processing',
                updatedAt: { lte: thirtyMinutesAgo }
            },
            data: {
                status: 'pending',
                lastError: 'Stale post recovery: Reset after processing timeout.'
            }
        });

        if (stuckPosts.count > 0) {
            console.log(`[WORKER] Recovered ${stuckPosts.count} stale scheduled posts.`);
        }
    } catch (err: any) {
        // Non-fatal: don't let stale job recovery kill the entire cycle
        console.warn(`[WORKER] Stale job recovery failed (non-fatal): ${err.message}`);
    }
}

async function checkAndProcess() {
    if (isRunning) {
        console.log("[WORKER] Previous cycle still in progress. Skipping.");
        return;
    }

    isRunning = true;
    const startedAt = new Date();

    // Backoff: if DB has been unreachable for multiple cycles, skip to avoid log spam
    if (consecutiveDbFailures >= MAX_SKIP_FAILURES) {
        // Only attempt a health check every 5th failure to reduce noise
        if (consecutiveDbFailures % 5 !== 0) {
            consecutiveDbFailures++;
            isRunning = false;
            return; // Silent skip
        }
    }

    // Quick DB health check before doing any work
    const dbOk = await isDbReachable();
    if (!dbOk) {
        consecutiveDbFailures++;
        if (consecutiveDbFailures <= 3) {
            console.warn(`[WORKER] Database unreachable (attempt ${consecutiveDbFailures}). Will retry next cycle.`);
        } else if (consecutiveDbFailures === MAX_SKIP_FAILURES) {
            console.warn(`[WORKER] Database unreachable for ${consecutiveDbFailures} consecutive cycles. Reducing log frequency.`);
        } else if (consecutiveDbFailures % 5 === 0) {
            console.warn(`[WORKER] Database still unreachable (${consecutiveDbFailures} cycles). Waiting...`);
        }
        isRunning = false;
        return;
    }

    // DB is back! Reset failure counter
    if (consecutiveDbFailures > 0) {
        console.log(`[WORKER] Database connection restored after ${consecutiveDbFailures} failed attempts.`);
        consecutiveDbFailures = 0;
    }

    console.log(`[WORKER] [${startedAt.toISOString()}] Starting cron cycle...`);

    let processedCount = 0;
    let publishedCount = 0;
    let failedCount = 0;
    let errorsCount = 0;

    try {
        await recoverStaleJobs();

        // 1. Fetch due posts with Row Locking (PostgreSQL specific)
        // SKIP LOCKED ensures horizontal scalability without double-processing
        // Use Promise.race to ensure a database hang doesn't block the worker indefinitely
        const duePostIds: { id: string }[] = await Promise.race([
            db.$queryRaw`
                SELECT id FROM "scheduled_posts"
                WHERE status = 'pending'
                AND "scheduledAt" <= NOW()
                ORDER BY "scheduledAt" ASC
                LIMIT 50
                FOR UPDATE SKIP LOCKED;
            `,
            new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Database query timeout (15s)')), 15000))
        ]);

        if (duePostIds.length === 0) {
            isRunning = false; // Early exit
            return;
        }

        processedCount = duePostIds.length;
        console.log(`[WORKER] Found ${processedCount} posts to process.`);

        for (const { id } of duePostIds) {
            try {
                // 2. Claim and Start Processing
                const post = await db.scheduledPost.update({
                    where: { id },
                    data: {
                        status: 'processing',
                        updatedAt: new Date()
                    },
                    include: { socialAccount: true }
                });

                console.log(`[WORKER] Processing ${post.platform} post: ${id}`);

                // 2.5 Rate Limit Check (Production Safety)
                const limitCheck = await checkPostingLimits(post.userId, post.platform);
                if (!limitCheck.allowed) {
                    console.log(`[WORKER] Rate limit hit for user ${post.userId} on ${post.platform}: ${limitCheck.error}`);
                    // Revert to pending and push forward by 5 minutes to avoid immediate thrashing
                    await db.scheduledPost.update({
                        where: { id },
                        data: {
                            status: 'pending',
                            scheduledAt: new Date(Date.now() + 5 * 60 * 1000),
                            lastError: `Rate Limit: ${limitCheck.error}`
                        }
                    });
                    continue;
                }

                // 3. Worker Logic: Prepare and Prepare for Publish
                const driftMs = post.scheduledAt ? Date.now() - post.scheduledAt.getTime() : 0;
                console.log(`[WORKER] Processing ${post.platform} post: ${id} (Drift: ${driftMs}ms)`);

                let result: any = null;

                if (post.platform === 'linkedin') {
                    if (!post.contentId) throw new Error("LinkedIn post missing contentId");

                    // DISPATCH TO INNGEST (Primary Engine)
                    console.log(`[WORKER] Dispatching LinkedIn post ${id} to Inngest engine...`);

                    await inngest.send({
                        name: "linkedin/post.publish",
                        data: {
                            postId: post.contentId,
                            scheduledPostId: post.id
                        }
                    });

                    // We don't mark as 'published' here anymore. 
                    // Inngest will handle the final status update.
                    // The worker just successfully 'dispatched'.
                    publishedCount++;
                } else if (post.platform === 'rss' || post.platform === 'manual') {
                    // ContentQueue based posts
                    const accessToken = await getValidAccessToken(post.socialAccountId);
                    const webhookUrl = process.env.N8N_PUBLISH_WEBHOOK_URL;

                    if (!webhookUrl) throw new Error("N8N_PUBLISH_WEBHOOK_URL not configured");

                    const response = await fetch(webhookUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-webhook-secret': process.env.WEBHOOK_SECRET || ''
                        },
                        body: JSON.stringify({
                            postId: post.id,
                            accessToken,
                            platform: post.platform,
                            postType: post.postType,
                            contentText: post.contentText,
                            callbackUrl: `${getBaseUrl()}/api/posts/update-status`
                        }),
                        signal: AbortSignal.timeout(30000)
                    });

                    if (!response.ok) throw new Error(`Webhook Failed: ${response.status}`);

                    // ContentQueue status update
                    if (post.contentId) {
                        await db.contentQueue.update({
                            where: { id: post.contentId },
                            data: { status: 'published', publishedAt: new Date() }
                        }).catch(() => { });
                    }

                    await db.scheduledPost.update({
                        where: { id },
                        data: {
                            status: 'published',
                            publishedAt: new Date(),
                            updatedAt: new Date()
                        }
                    });
                    publishedCount++;
                } else {
                    // Default fallback for other platforms
                    const accessToken = await getValidAccessToken(post.socialAccountId);
                    const webhookUrl = process.env.N8N_PUBLISH_WEBHOOK_URL;
                    if (webhookUrl && accessToken) {
                        await fetch(webhookUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ postId: post.id, accessToken })
                        });
                    }

                    await db.scheduledPost.update({
                        where: { id },
                        data: {
                            status: 'published',
                            publishedAt: new Date(),
                            updatedAt: new Date()
                        }
                    });
                    publishedCount++;
                }


            } catch (postError: any) {
                console.error(`[WORKER] Error processing post ${id}:`, postError.message);
                failedCount++;
                errorsCount++;

                const currentPost = await db.scheduledPost.findUnique({ where: { id } });
                const retryCount = (currentPost?.retryCount || 0) + 1;
                const setStatus = retryCount < 3 ? 'pending' : 'failed';

                await db.scheduledPost.update({
                    where: { id },
                    data: {
                        status: setStatus,
                        retryCount: retryCount,
                        lastError: postError.message,
                        updatedAt: new Date()
                    }
                });
            }
        }
    } catch (globalError: any) {
        // If it's a connection error (P1001), log a simple warning instead of a critical stack trace
        if (globalError.code === 'P1001' || globalError.message?.includes('Can\'t reach database')) {
            console.warn(`[WORKER] Cycle aborted: Database connection lost.`);
            consecutiveDbFailures++;
        } else {
            console.error("[WORKER] [CRITICAL] Global execution error:", globalError.message);
        }
    } finally {
        try {
            const finishedAt = new Date();
            const executionTimeMs = finishedAt.getTime() - startedAt.getTime();

            // 4. Log execution summary (non-fatal, silent on failure)
            if (processedCount > 0 || publishedCount > 0) {
                await db.cronExecutionLog.create({
                    data: {
                        startedAt,
                        finishedAt,
                        processed: processedCount,
                        published: publishedCount,
                        failed: failedCount,
                        executionTimeMs,
                        errorsCount
                    }
                }).catch(() => { });
            }

            console.log(`[WORKER] Cycle complete. Processed: ${processedCount}, Success: ${publishedCount}, Failed: ${failedCount}`);
        } catch (finalErr) {
            // Absolute last resort safety
        } finally {
            isRunning = false;
        }
    }
}

// Start Scheduler
console.log("[WORKER] SocialSyncAra Backend Scheduler Active (Running Every Minute)");
cron.schedule('* * * * *', checkAndProcess);

// Handle process signals for graceful shutdown
process.on('SIGTERM', () => {
    console.log("[WORKER] SIGTERM received. Closing...");
    process.exit(0);
});

// Run immediately on startup
checkAndProcess();
