import db from '../lib/db';

async function main() {
    try {
        const pendingCount = await db.scheduledPost.count({
            where: { status: 'pending' }
        });

        const dueCount = await db.scheduledPost.count({
            where: {
                status: 'pending',
                scheduledAt: { lte: new Date() }
            }
        });

        console.log(`Total Pending: ${pendingCount}`);
        console.log(`Due for Processing: ${dueCount}`);

        if (dueCount > 0) {
            const nextPosts = await db.scheduledPost.findMany({
                where: { status: 'pending' },
                orderBy: { scheduledAt: 'asc' },
                take: 5
            });
            console.log("Next 5 posts:", JSON.stringify(nextPosts, null, 2));
        }
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

main();
