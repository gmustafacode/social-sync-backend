
import { PrismaClient } from '../lib/generated/prisma';
import 'dotenv/config';

async function checkPosts() {
    const prisma = new PrismaClient();
    try {
        console.log("Checking last 5 LinkedInPosts...");
        const posts = await prisma.linkedInPost.findMany({
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
                id: true,
                status: true,
                linkedinPostUrn: true,
                createdAt: true,
                description: true
            }
        });
        console.log(JSON.stringify(posts, null, 2));

        console.log("\nChecking ScheduledPosts...");
        const scheduled = await prisma.scheduledPost.findMany({
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
                id: true,
                status: true,
                contentId: true,
                scheduledAt: true
            }
        });
        console.log(JSON.stringify(scheduled, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkPosts();
