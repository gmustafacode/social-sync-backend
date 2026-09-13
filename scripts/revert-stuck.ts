
import { PrismaClient } from '../lib/generated/prisma';
import 'dotenv/config';

async function revertStuckPosts() {
    const prisma = new PrismaClient();
    try {
        console.log("Reverting stuck PROCESSING posts to PENDING...");

        const liUpdate = await prisma.linkedInPost.updateMany({
            where: {
                status: 'PROCESSING',
                linkedinPostUrn: null
            },
            data: {
                status: 'PENDING'
            }
        });
        console.log(`Updated ${liUpdate.count} LinkedInPosts.`);

        const sUpdate = await prisma.scheduledPost.updateMany({
            where: {
                status: 'processing'
            },
            data: {
                status: 'pending'
            }
        });
        console.log(`Updated ${sUpdate.count} ScheduledPosts.`);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

revertStuckPosts();
