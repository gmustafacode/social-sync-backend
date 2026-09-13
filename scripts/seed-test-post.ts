import db from '../lib/db';

async function main() {
    try {
        const account = await db.socialAccount.findFirst({
            where: { status: 'active' }
        });

        if (!account) {
            console.error("No active social account found to test with.");
            process.exit(1);
        }

        console.log(`Found active account: ${account.platform} (${account.id})`);

        // Use a random ID for contentId to test the fallback logic
        const testPostId = `test-post-${Date.now()}`;

        const post = await db.scheduledPost.create({
            data: {
                userId: account.userId,
                socialAccountId: account.id,
                platform: account.platform,
                postType: 'TEXT',
                contentText: `Backend Worker Test - ${new Date().toISOString()}`,
                targetType: 'FEED',
                scheduledAt: new Date(Date.now() - 1000 * 60), // 1 minute ago
                status: 'pending',
                contentId: testPostId // This will trigger the fallback or fail if we don't handle missing content record
            }
        });

        console.log("Created test scheduled post:", post.id);

        // Also create a dummy ContentQueue item if needed, but let's see how it handles it.
        // Actually, my new publishPost handles missing records by throwing... 
        // Let's create the dummy ContentQueue item to be sure.

        if (account.platform === 'linkedin') {
            await db.contentQueue.create({
                data: {
                    id: testPostId,
                    userId: account.userId,
                    source: 'MANUAL',
                    contentType: 'text',
                    title: 'Worker Test Title',
                    summary: 'Worker Test Content',
                    status: 'pending'
                }
            });
            console.log("Created dummy ContentQueue record:", testPostId);
        }

    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

main();
