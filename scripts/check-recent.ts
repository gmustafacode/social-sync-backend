import { PrismaClient } from '../lib/generated/prisma'

const db = new PrismaClient()

async function check() {
    const userId = '3ab52c6e-937a-4f03-9ce3-d0e4b7abdcd2';
    console.log(`Checking activity for user: ${userId}`);

    const recentPosts = await db.linkedInPost.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) } }, // Last 30 mins
        orderBy: { createdAt: 'desc' }
    });

    console.log(`Found ${recentPosts.length} recent LinkedInPosts.`);
    recentPosts.forEach(p => console.log(`- Post ID: ${p.id}, Status: ${p.status}, Created: ${p.createdAt}`));

    const recentQueue = await db.contentQueue.findMany({
        where: { userId, createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) } },
        orderBy: { createdAt: 'desc' }
    });

    console.log(`Found ${recentQueue.length} recent ContentQueue items.`);
    recentQueue.forEach(q => console.log(`- Queue ID: ${q.id}, Status: ${q.status}, Created: ${q.createdAt}`));
}

check()
    .catch(console.error)
    .finally(() => db.$disconnect());
