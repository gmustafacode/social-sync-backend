import { inngest } from "./client";
import { getTriggerSlotKey, isTriggerDue } from "../automation-helper";
import db from "../db";
import { LinkedInPostingService } from "../linkedin-posting-service";
import { checkPostingLimits } from "../limits";
import { getValidAccessToken } from "../oauth";
import { getBaseUrl } from "../utils";
import { AIService } from "../ai-service";
import { fetchRSS } from "../ingestion/connectors/rss";
import { fetchReddit } from "../ingestion/connectors/reddit";
import { fetchNewsAPI } from "../ingestion/connectors/news";
import { fetchUnsplash } from "../ingestion/connectors/unsplash";
import { fetchPexels } from "../ingestion/connectors/pexels";
import { processIngestedContent } from "../ingestion/processor";
import { NormalizedContent } from "../ingestion/types";

/**
 * =========================================================================
 * 🔴 FUNCTION 1 — MASTER ORCHESTRATOR
 * ============================================================================
 * Purpose: Central brain. Manages events, workflow chaining, failures.
 * Routes tasks to appropriate engines.
 */
export const masterOrchestrator = inngest.createFunction(
    { id: "master-orchestrator", concurrency: 5 },
    [
        { event: "app/orchestrator.route" }
    ],
    async ({ event, step }) => {
        const { action, payload } = event.data;

        await step.run(`routing-${action}`, async () => {
            console.log(`[Orchestrator] Routing action: ${action}`);
        });

        switch (action) {
            case "CREATE_CONTENT":
                await inngest.send({ name: "app/content.generate", data: payload });
                break;
            case "PUBLISH_NOW":
                await inngest.send({ name: "app/post.publish_now", data: payload });
                break;
            case "SCHEDULE_POST":
                // Scheduled via DB, trigger any real-time processing needed here
                break;
            case "ANALYZE_POSTS":
                await inngest.send({ name: "app/analytics.analyze", data: payload });
                break;
        }

        return { routed: action, success: true };
    }
);

/**
 * =========================================================================
 * 🟢 FUNCTION 2 — CONTENT ENGINE
 * ============================================================================
 * Purpose: Full content factory (Research + AI Generation + Formatting).
 */
export const contentEngine = inngest.createFunction(
    { id: "content-engine", concurrency: 2 },
    [
        { cron: process.env.INGESTION_CRON || "0 */4 * * *" }, // Research & Collection Phase
        { event: "app/content.generate" }, // Manual Generation Phase
        { cron: "*/30 * * * *" }, // Automatic AI Generation Phase
        { event: "ai/content.analyze" } // Legacy backward compatibility
    ],
    async ({ event, step }) => {
        const isIngestionEvent = !event.name && (event as any).cron === (process.env.INGESTION_CRON || "0 */4 * * *");
        const isGenerationEvent = event.name === "app/content.generate" || event.name === "ai/content.analyze" || (!event.name && (event as any).cron === "*/30 * * * *");

        let researchStats: any = null;
        let aiStats: any = null;

        // --- Data Collection & Trend Research ---
        if (isIngestionEvent) {
            const sources = ['rss', 'reddit', 'news_api', 'unsplash', 'pexels'];
            const category = 'technology';
            const query = 'technology';

            const results = [];
            for (const source of sources) {
                const items = await step.run(`fetch-${source}`, async () => {
                    let fetched: NormalizedContent[] = [];
                    switch (source) {
                        case 'rss': fetched = await fetchRSS('https://feeds.feedburner.com/TechCrunch/'); break;
                        case 'reddit': fetched = await fetchReddit(category); break;
                        case 'news_api': fetched = await fetchNewsAPI(category); break;
                        case 'unsplash': fetched = await fetchUnsplash(query); break;
                        case 'pexels': fetched = await fetchPexels(query); break;
                    }
                    return fetched;
                });

                if (items.length > 0) {
                    const itemsWithDates = items.map((item: any) => ({
                        ...item,
                        publishedAt: item.publishedAt ? new Date(item.publishedAt) : undefined
                    }));

                    const result = await step.run(`process-${source}`, async () => {
                        return await processIngestedContent(source as any, itemsWithDates);
                    });
                    results.push(result);
                }
            }
            researchStats = { processedSources: results.length, details: results };
        }

        // --- AI Content Generation & Validation ---
        if (isGenerationEvent) {
            const batchSize = event.data?.batchSize || 10;
            aiStats = await step.run("generate-ai-content", async () => {
                return await AIService.processBatch(batchSize);
            });
        }

        return { success: true, researchStats, aiStats };
    }
);

/**
 * =========================================================================
 * 🔵 FUNCTION 3 — SCHEDULER + PUBLISHER
 * ============================================================================
 * Purpose: Queue management, time-zone handling, and auto-publishing to ALL platforms.
 */
export const schedulerPublisher = inngest.createFunction(
    { id: "scheduler-publisher", concurrency: 5 },
    [
        { cron: "*/10 * * * *" }, // Engine Tick (Automation + Scheduler)
        { event: "linkedin/post.publish" }, // Immediate Publisher (Legacy Support)
        { event: "app/post.publish_now" }, // Immediate Publisher (Universal Support)
        { event: "linkedin/post.schedule" }, // sleep-until precise delivery
        { event: "app/post.schedule" } // sleep-until precise delivery
    ],
    async ({ event, step, runId }) => {
        const isImmediate = event.name === "linkedin/post.publish" || event.name === "app/post.publish_now";
        const isScheduledEvent = event.name === "linkedin/post.schedule" || event.name === "app/post.schedule";
        const isCron = !event.name || event.name === "inngest/scheduled.timer";
        const startTime = Date.now();

        // --- EXACT TIME SCHEDULED PUBLISHER (Sleep-Until) ---
        if (isScheduledEvent) {
            const { scheduledPostId, scheduledFor } = event.data;
            if (!scheduledPostId || !scheduledFor) return { error: "Missing scheduledPostId or scheduledFor timestamp" };

            // 1. Sleep until the exact scheduled time
            await step.sleepUntil("wait-until-scheduled-time", new Date(scheduledFor));

            // 2. Verify post is still valid
            const post = await step.run("verify-post-before-publish", async () => {
                return await db.scheduledPost.findUnique({
                    where: { id: scheduledPostId },
                    select: { id: true, status: true, contentId: true, platform: true }
                });
            });

            if (!post) return { skipped: true, reason: "Post no longer exists" };
            if (post.status !== 'pending') return { skipped: true, reason: `Post status is ${post.status}, expected pending` };

            // 3. Fast-track to the immediate publisher 
            await step.run("dispatch-immediate-publish", async () => {
                const eventName = post.platform === 'linkedin' ? "linkedin/post.publish" : "app/post.publish_now";
                await inngest.send({
                    name: eventName,
                    data: {
                        postId: post.platform === 'linkedin' ? post.contentId : post.id,
                        scheduledPostId: post.id,
                        platform: post.platform
                    }
                });
            });

            return { success: true, message: "Woke up and dispatched to immediate publisher", scheduledPostId };
        }

        // --- IMMEDIATE PUBLISHER ---
        if (isImmediate) {
            const { postId, scheduledPostId, platform } = event.data;
            if (!postId && !scheduledPostId) return { error: "Missing ID" };

            if (platform === 'linkedin' || event.name === 'linkedin/post.publish') {
                const post = await step.run("mark-processing-li", async () => {
                    const result = await db.linkedInPost.updateMany({
                        where: { id: postId, status: { in: ['SCHEDULED', 'PENDING', 'DRAFT'] }, linkedinPostUrn: null },
                        data: { status: 'PROCESSING' }
                    });
                    if (result.count === 0) return null;
                    return await db.linkedInPost.findUnique({ where: { id: postId }, include: { socialAccount: true } });
                });

                if (!post) {
                    console.warn(`[Inngest] Skipping LinkedIn post ${postId} (Already processing or missing)`);
                    return { skipped: true };
                }

                const result = await step.run("publish-via-li-service", async () => {
                    return await LinkedInPostingService.publishPost(postId);
                });

                if (scheduledPostId) {
                    await step.run("sync-scheduled-post", async () => {
                        const r = result as any;
                        const externalId = r.results?.[0] || null;
                        const isSuccess = r.status === 'PUBLISHED' || r.status === 'PARTIAL_SUCCESS';

                        await db.scheduledPost.update({
                            where: { id: scheduledPostId },
                            data: {
                                status: isSuccess ? 'published' : 'failed',
                                publishedAt: isSuccess ? new Date() : null,
                                externalPostId: externalId,
                                lastError: isSuccess ? null : (r.errors?.join(' | ') || 'Publishing skipped or failed')
                            }
                        });
                    });
                }
                return { success: true, ...result };
            } else {
                // UNIVERSAL PUBLISHER (Immediate)
                const targetPostId = scheduledPostId || postId;
                const post = await step.run("fetch-universal-post", async () => {
                    return await db.scheduledPost.findUnique({
                        where: { id: targetPostId },
                        include: { socialAccount: true }
                    });
                });

                if (!post || post.status === 'published') return { skipped: true };

                return await step.run("publish-universal-immediate", async () => {
                    const accessToken = await getValidAccessToken(post.socialAccountId);
                    const webhookUrl = process.env.N8N_PUBLISH_WEBHOOK_URL;
                    if (!webhookUrl) throw new Error("Universal Publisher Webhook Missing");

                    const resp = await fetch(webhookUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-webhook-secret': process.env.WEBHOOK_SECRET || '' },
                        body: JSON.stringify({
                            postId: post.id,
                            accessToken,
                            platform: post.platform.toLowerCase(),
                            contentText: post.contentText,
                            mediaUrl: post.mediaUrl,
                            callbackUrl: `${getBaseUrl()}/api/posts/update-status`
                        }),
                        signal: AbortSignal.timeout(20000)
                    });

                    if (!resp.ok) throw new Error(`Webhook Error: ${resp.status}`);
                    await db.scheduledPost.update({ where: { id: post.id }, data: { status: 'processing', updatedAt: new Date() } });
                    return { success: true };
                });
            }
        }

        // --- ENGINE TICK (CRON) ---
        if (isCron) {
            const now = event.ts ? new Date(event.ts) : new Date();
            console.log(`[Inngest] Engine Tick Started: ${now.toISOString()} (Event: ${event.name})`);

            // 1. AUTOMATION TRIGGER PHASE
            const automationResults = await step.run("automation-trigger-evaluation", async () => {
                const preferences = await db.preference.findMany({
                    where: {
                        automationLevel: { in: ['Full Auto', 'Semi-Auto'] },
                        postingSchedule: { not: { equals: null } }
                    }
                });

                const triggered = [];
                for (const pref of preferences) {
                    const schedule = typeof pref.postingSchedule === 'string'
                        ? JSON.parse(pref.postingSchedule)
                        : pref.postingSchedule;

                    const isDue = isTriggerDue(schedule as any, (pref as any).timezone, now);
                    if (isDue) {
                        const slotKey = getTriggerSlotKey(schedule as any, pref.timezone, now);
                        if (!slotKey) continue;
                        // Mongo's conditional update is the durable claim. A retry or a
                        // second worker cannot claim the same local schedule slot.
                        const claimed = await db.preference.update({
                            where: { userId: pref.userId, automationLastTriggerKey: { not: slotKey } },
                            data: { automationLastTriggerKey: slotKey }
                        });
                        if (claimed) triggered.push({ userId: pref.userId, slotKey });
                    }
                }
                return triggered;
            });

            // Process each triggered automation
            for (const trigger of automationResults) {
                const { userId, slotKey } = trigger;
                const pref = await db.preference.findUnique({ where: { userId } });
                if (!pref) continue;

                // Refresh research for this trigger. The separate ingestion cron
                // remains useful for the general queue, but automation must not
                // depend on research collected hours earlier.
                await step.run(`fresh-research-${userId}-${slotKey}`, async () => {
                    const query = pref.industryNiche || 'technology';
                    const sources = [
                        ['rss', () => fetchRSS('https://feeds.feedburner.com/TechCrunch/')],
                        ['reddit', () => fetchReddit(query)],
                        ['news_api', () => fetchNewsAPI(query)]
                    ] as const;
                    for (const [source, fetcher] of sources) {
                        try {
                            const items = await fetcher();
                            if (items.length > 0) {
                                await processIngestedContent(source, items.map(item => ({
                                    ...item,
                                    publishedAt: item.publishedAt ? new Date(item.publishedAt) : undefined
                                })));
                            }
                        } catch (error) {
                            console.error(`[Automation] Fresh ${source} ingestion failed for ${userId}:`, error);
                        }
                    }
                });

                await step.run(`process-automation-${userId}-${slotKey}`, async () => {
                    // ── DYNAMIC TOPIC GENERATION: Avoid repetition ──
                    const recentPosts = await db.scheduledPost.findMany({
                        where: { userId: pref.userId, status: 'published' },
                        orderBy: { publishedAt: 'desc' },
                        take: 10,
                        select: { contentText: true }
                    });
                    const recentTopics = recentPosts.map(p => p.contentText.slice(0, 50) + "...");

                    const niche = pref.industryNiche || 'my industry';
                    const brand = pref.brandName || 'my brand';
                    const goals = pref.contentGoals || 'growth';
                    const freshResearch = await db.contentQueue.findMany({
                        where: { createdAt: { gte: new Date(now.getTime() - 30 * 60000) } },
                        orderBy: { createdAt: 'desc' },
                        take: 8,
                        select: { title: true, summary: true }
                    });
                    const researchContext = freshResearch
                        .map(item => `${item.title}: ${item.summary || ''}`)
                        .join(' | ');

                    const topic = await AIService.generateDynamicTopic(
                        pref.userId,
                        `${niche}. Include these topics where relevant: ${(pref.topicPreferences || []).join(', ')}. Avoid: ${(pref.excludedTopics || []).join(', ')}. Fresh research: ${researchContext}`,
                        brand,
                        goals,
                        recentTopics
                    );

                    let graphResult: any = null;
                    try {
                        graphResult = await AIService.runIntelligenceLayer(
                            pref.userId,
                            topic,
                            pref.audienceType || undefined,
                            pref.contentTone || undefined,
                            pref.preferredContentTypes?.[0] || undefined
                        );
                    } catch (err) {
                        console.error(`[Inngest] Intelligence pipeline failed for user ${userId}:`, err);
                        return;
                    }

                    // ── Safety gate: only proceed if content passed moderation ──
                    if (!graphResult?.safetyStatus?.isSafe) {
                        console.warn(`[Inngest] Safety check failed for user ${userId}. Skipping publish.`);
                        return;
                    }

                    const platformContent: Record<string, any> = graphResult.platformContent || {};
                    let mediaUrls: string[] = graphResult.mediaUrls || [];

                    // Fetch media only when the configured preference allows or requires it.
                    if (mediaUrls.length === 0 && pref.mediaPreference !== 'text_only') {
                        try {
                            const searchQuery = topic || niche || 'technology';
                            const images = await fetchUnsplash(searchQuery);
                            if (images && images.length > 0 && images[0].mediaUrl) {
                                mediaUrls = [images[0].mediaUrl];
                                console.log(`[Inngest] Fetched Unsplash image for topic "${searchQuery}": ${mediaUrls[0]}`);
                            }
                        } catch (err) {
                            console.error(`[Inngest] Failed to fetch Unsplash image for automation:`, err);
                        }
                    }

                    if (pref.automationLevel === 'Semi-Auto') {
                        // Save to content queue for manual review
                        const firstPlatform = Object.keys(platformContent)[0] || 'general';
                        const postText = platformContent[firstPlatform]?.text || graphResult.rawContent || '';
                        await db.contentQueue.create({
                            data: {
                                userId: pref.userId,
                                source: 'automation',
                                contentType: mediaUrls.length > 0 ? 'image_text' : (pref.preferredContentTypes?.[0] || 'text_only'),
                                rawContent: postText,
                                status: 'pending',
                                title: `Auto-generated content for review`,
                                mediaUrl: mediaUrls[0] || null,
                            }
                        });

                    } else if (pref.automationLevel === 'Full Auto') {
                        // ── Determine active platforms (respecting per-platform enable/disable) ──
                        const platformPrefs = (pref.platformPreferences ?? {}) as Record<string, any>;
                        const selectedAccounts = new Set(pref.selectedAccountIds || []);
                        const activePlatforms = (pref.preferredPlatforms || []).filter(p => {
                            const ppref = platformPrefs[p];
                            return ppref === undefined || ppref?.enabled !== false;
                        });

                        for (const platform of activePlatforms) {
                            const socialAccount = await db.socialAccount.findFirst({
                                where: {
                                    userId: pref.userId,
                                    platform,
                                    status: 'active',
                                    ...(selectedAccounts.size ? { id: { in: [...selectedAccounts] } } : {})
                                }
                            });
                            if (!socialAccount) continue;

                            const platformText = platformContent[platform]?.text || graphResult.rawContent || '';
                            const mediaUrl = mediaUrls[0] || null;

                            let contentId: string | null = null;
                            if (platform === 'linkedin') {
                                const liPost = await db.linkedInPost.create({
                                    data: {
                                        userId: pref.userId,
                                        socialAccountId: socialAccount.id,
                                        // DYNAMIC POST TYPE based on media availability
                                        postType: mediaUrl ? 'IMAGE_TEXT' : 'TEXT',
                                        description: platformText,
                                        targetType: 'FEED',
                                        visibility: 'PUBLIC',
                                        status: 'PENDING',
                                        ...(mediaUrl ? { mediaUrls: [mediaUrl] } : {})
                                    }
                                });
                                contentId = liPost.id;
                            }

                            const post = await db.scheduledPost.create({
                                data: {
                                    userId: pref.userId,
                                    socialAccountId: socialAccount.id,
                                    platform,
                                    // Map preference to correct DB post type
                                    postType: mediaUrl ? 'IMAGE_TEXT' : (pref.preferredContentTypes?.[0] || 'text_only').toUpperCase(),
                                    contentText: platformText,
                                    targetType: 'FEED',
                                    status: 'pending',
                                    scheduledAt: new Date(),
                                    contentId,
                                    mediaUrl,
                                    automationTriggerKey: `${slotKey}:${platform}:${socialAccount.id}`,
                                }
                            });

                            await inngest.send({
                                name: platform === 'linkedin' ? "linkedin/post.publish" : "app/post.publish_now",
                                data: {
                                    postId: platform === 'linkedin' ? contentId : post.id,
                                    scheduledPostId: post.id,
                                    platform
                                },
                            });
                        }
                    }
                });

            }

            // 2. SCHEDULER DISPATCH PHASE
            const duePosts = await step.run("fetch-due-posts-atomic", async () => {
                const posts: any[] = await db.$queryRaw`
                    WITH target_posts AS (
                        SELECT id FROM "scheduled_posts"
                        WHERE status = 'pending' AND "scheduledAt" <= NOW() AND "retry_count" < 5
                        ORDER BY "scheduledAt" ASC LIMIT 20
                        FOR UPDATE SKIP LOCKED
                    )
                    UPDATE "scheduled_posts"
                    SET status = 'processing', "updatedAt" = NOW()
                    WHERE id IN (SELECT id FROM target_posts)
                    RETURNING id, "userId", platform, "content_id" as "contentId", "socialAccountId", "postType", "contentText", "retry_count" as "retryCount", "scheduledAt";
                `;
                return posts.map(p => ({
                    ...p,
                    contentId: p.contentId || p.contentid,
                    userId: p.userId || p.userid,
                    socialAccountId: p.socialAccountId || p.socialaccountid,
                    retryCount: p.retryCount || p.retrycount || 0,
                    scheduledAt: p.scheduledAt || p.scheduledat
                }));
            });

            const processResults = await step.run("dispatch-all-posts", async () => {
                const results = [];
                for (const post of duePosts) {
                    try {
                        const limitCheck = await checkPostingLimits(post.userId, post.platform);
                        if (!limitCheck.allowed) {
                            const backoffMinutes = (post.retryCount + 1) * 15;
                            await db.scheduledPost.update({
                                where: { id: post.id },
                                data: {
                                    status: 'pending',
                                    scheduledAt: new Date(Date.now() + backoffMinutes * 60000),
                                    lastError: `Rate Limit reached: ${limitCheck.error}`,
                                    retryCount: { increment: 1 }
                                }
                            });
                            results.push({ id: post.id, status: "rate_limited_retry" });
                            continue;
                        }

                        if (post.platform === 'linkedin') {
                            await inngest.send({
                                name: "linkedin/post.publish",
                                data: { postId: post.contentId, scheduledPostId: post.id },
                                idempotencyKey: `publish-li-${post.id}-${new Date(post.scheduledAt).getTime()}`
                            });
                            results.push({ id: post.id, status: "dispatched_to_native_inngest" });
                        } else {
                            const accessToken = await getValidAccessToken(post.socialAccountId);
                            const webhookUrl = process.env.N8N_PUBLISH_WEBHOOK_URL;
                            if (!webhookUrl) throw new Error("Universal Publisher Webhook Missing");

                            const resp = await fetch(webhookUrl, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'x-webhook-secret': process.env.WEBHOOK_SECRET || '' },
                                body: JSON.stringify({
                                    postId: post.id,
                                    accessToken,
                                    platform: post.platform,
                                    contentText: post.contentText,
                                    callbackUrl: `${getBaseUrl()}/api/posts/update-status`
                                }),
                                signal: AbortSignal.timeout(20000)
                            });

                            if (!resp.ok) throw new Error(`Webhook Error: ${resp.status}`);
                            // Mark as processing, not published! The webhook callback will finalize it.
                            await db.scheduledPost.update({
                                where: { id: post.id },
                                data: { status: 'processing', updatedAt: new Date() }
                            });
                            results.push({ id: post.id, status: "dispatched_via_webhook" });
                        }
                    } catch (err: any) {
                        const isMaxRetries = post.retryCount >= 4;
                        await db.scheduledPost.update({
                            where: { id: post.id },
                            data: {
                                status: isMaxRetries ? 'failed' : 'pending',
                                lastError: err.message,
                                retryCount: { increment: 1 },
                                scheduledAt: isMaxRetries ? undefined : new Date(Date.now() + (post.retryCount + 1) * 10 * 60000),
                                updatedAt: new Date()
                            }
                        });
                        results.push({ id: post.id, status: isMaxRetries ? "failed_max_retries" : "retry_queued", error: err.message });
                    }
                }
                return results;
            });

            const publishedCount = processResults.filter((r: any) => r.status === "dispatched_to_native_inngest" || r.status === "published_via_webhook").length;
            const failedCount = processResults.filter((r: any) => r.status === "failed").length;

            await step.run("log-execution", async () => {
                const finishedAt = new Date();
                await db.cronExecutionLog.create({
                    data: {
                        startedAt: new Date(startTime),
                        finishedAt,
                        processed: duePosts.length,
                        published: publishedCount,
                        failed: failedCount,
                        executionTimeMs: finishedAt.getTime() - startTime,
                        errorsCount: failedCount
                    }
                }).catch(() => { });
            });

            return { processed: duePosts.length, automationUsers: automationResults.length, results: processResults };
        }
    }
);

/**
 * =========================================================================
 * 🟣 FUNCTION 4 — ANALYTICS ENGINE
 * ============================================================================
 * Purpose: Performance intelligence, AI sentiment analysis (Positive/Negative impact).
 */
export const analyticsEngine = inngest.createFunction(
    { id: "analytics-engine", concurrency: 1 },
    [
        { cron: "0 2 * * *" }, // Runs daily at 2AM
        { event: "app/analytics.analyze" }
    ],
    async ({ step }) => {
        const results = await step.run("extract-learnings", async () => {
            const lastWeek = new Date();
            lastWeek.setDate(lastWeek.getDate() - 7);

            const posts = await db.postHistory.findMany({
                where: { status: 'PUBLISHED', postedAt: { gte: lastWeek }, engagementMetrics: { not: null } },
                take: 50
            });

            let learningsExtracted = 0;

            for (const post of posts) {
                if (!post.engagementMetrics) continue;
                try {
                    const metrics = typeof post.engagementMetrics === 'string' ? JSON.parse(post.engagementMetrics) : post.engagementMetrics;
                    if (metrics.comments > 0) {
                        // Real-world implementation would fetch comments from the platform API here
                        // For now, we process as a positive/negative learning based on metrics 
                        // even without specific comment text, or we can use empty array.
                        const mockComments: string[] = []; // In development/audit: keep it empty to prove system works with empty state

                        const originalContent = (await db.linkedInPost.findUnique({
                            where: { id: post.postId! },
                            select: { description: true }
                        }))?.description || "Example text";

                        const success = await AIService.extractLearningsFromFeedback(
                            post.userId, post.postId!, originalContent, mockComments
                        );

                        if (success) learningsExtracted++;
                    }
                } catch (e) {
                    console.error("Failed to extract learnings for post", post.id, e);
                }
            }

            return { processed: posts.length, learningsExtracted };
        });

        return { message: "Feedback Loop Complete", stats: results };
    }
);

/**
 * =========================================================================
 * 🟡 FUNCTION 5 — SYSTEM UTILITIES
 * ============================================================================
 * Purpose: Failure handling, cleanup, consistency checks, health monitoring.
 */
export const systemUtilities = inngest.createFunction(
    { id: "system-utilities", concurrency: 1 },
    [
        { cron: "0 * * * *" } // Hourly cleanup
    ],
    async ({ step }) => {
        // Recover stale jobs
        await step.run("recover-stale-jobs", async () => {
            const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
            await db.scheduledPost.updateMany({
                where: { status: 'processing', updatedAt: { lte: thirtyMinutesAgo } },
                data: { status: 'pending', lastError: 'Stale post recovery: Reset after processing timeout.' }
            });
        });

        return { success: true, message: "System cleanup complete" };
    }
);


