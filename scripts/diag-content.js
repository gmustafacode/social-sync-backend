
const { PrismaClient } = require('../lib/generated/prisma');
const prisma = new PrismaClient();

async function check() {
    try {
        const count = await prisma.contentQueue.count();
        console.log(`[CHECK] Total queue items: ${count}`);

        const pending = await prisma.contentQueue.findMany({
            where: { status: 'pending' },
            take: 5
        });
        console.log(`[CHECK] Pending samples:`, pending.map(p => p.title));

        const logs = await prisma.ingestionLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 3
        });
        console.log(`[CHECK] Recent logs:`, logs.map(l => `${l.source}: fetched=${l.fetchedCount}, saved=${l.savedCount}`));

    } catch (e) {
        console.error("[CHECK] Failed:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}

check();