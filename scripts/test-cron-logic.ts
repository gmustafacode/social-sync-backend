import db from '../lib/db';
import { inngest } from '../lib/inngest/client';
import { checkPostingLimits } from '../lib/limits';
import { getValidAccessToken } from '../lib/oauth';
import { getBaseUrl } from '../lib/utils';

async function testCronLogic() {
    console.log("--- Starting Manual Cron Logic Test ---");
    const startedAt = new Date();

    try {
        // 1. Recover Stale Jobs
        console.log("1. Checking for stale jobs...");
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        const recovered = await db.scheduledPost.updateMany({
            where: {
                status: 'processing',
                updatedAt: { lte: thirtyMinutesAgo }
            },
            data: {
                status: 'pending',
                lastError: 'Manual Test: Reset after processing timeout.'
            }
        });
        console.log(`Recovered ${recovered.count} jobs.`);

        // 2. Fetch Due Posts
        console.log("2. Fetching due posts...");
        const duePosts: any[] = await db.$queryRaw`
            SELECT id, "userId", platform, "content_id" as "contentId", "socialAccountId", "postType", "contentText" 
            FROM "scheduled_posts"
            WHERE status = 'pending'
            AND "scheduledAt" <= NOW()
            ORDER BY "scheduledAt" ASC
            LIMIT 5
            FOR UPDATE SKIP LOCKED;
        `;

        console.log(`Found ${duePosts.length} posts due.`);

        if (duePosts.length === 0) {
            console.log("No posts due for processing. Seeding a test post...");

            const user = await db.user.findFirst();
            const sa = await db.socialAccount.findFirst();

            if (!user || !sa) {
                console.log("Could not find a valid user or social account to seed test post.");
                return;
            }

            const now = new Date();
            const testPost = await db.scheduledPost.create({
                data: {
                    userId: user.id,
                    platform: 'linkedin',
                    status: 'pending',
                    scheduledAt: new Date(now.getTime() - 1000),
                    contentText: 'Test post from Inngest Cron logic check',
                    socialAccountId: sa.id,
                    postType: 'TEXT',
                    targetType: 'FEED'
                }
            });
            console.log(`Created test post: ${testPost.id}`);
            // Restart the test loop to find the newly created post
            return testCronLogic();
        }


        // 3. Process Each Post
        for (const post of duePosts) {
            console.log(`Processing Post ID: ${post.id} (${post.platform})`);

            // 3.1 Rate Limit Check
            const limitCheck = await checkPostingLimits(post.userId, post.platform);
            if (!limitCheck.allowed) {
                console.log(`Rate limit hit: ${limitCheck.error}`);
                continue;
            }

            // 3.2 Mark Processing
            await db.scheduledPost.update({
                where: { id: post.id },
                data: { status: 'processing', updatedAt: new Date() }
            });

            // 3.3 Dispatch Logic (Mocking Inngest Send)
            if (post.platform === 'linkedin') {
                console.log(`[LINKEDIN] Would dispatch to Inngest event: linkedin/post.publish`);
                // In a real test, you might want to call inngest.send, but here we just check logic
            } else {
                console.log(`[${post.platform.toUpperCase()}] Would dispatch via Webhook`);
            }

            // For testing, let's mark it as published so we don't loop forever
            await db.scheduledPost.update({
                where: { id: post.id },
                data: { status: 'published', publishedAt: new Date() }
            });
            console.log(`Post ${post.id} marked as published.`);
        }

        console.log("--- Manual Test Complete ---");
    } catch (error) {
        console.error("Test failed:", error);
    } finally {
        process.exit(0);
    }
}

testCronLogic();
