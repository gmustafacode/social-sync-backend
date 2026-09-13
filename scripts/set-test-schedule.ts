import { PrismaClient } from '../lib/generated/prisma'

const prisma = new PrismaClient()

async function main() {
    const email = 'developerssphere@gmail.com';
    const user = await prisma.user.findUnique({
        where: { email },
        include: { preferences: true }
    });

    if (!user || !user.preferences) {
        console.log("User or preferences not found");
        return;
    }

    const updated = await prisma.preference.update({
        where: { id: user.preferences.id },
        data: {
            postingSchedule: [
                { day: 'Everyday', time: '14:35' }
            ],
            timezone: 'Asia/Karachi'
        }
    });

    console.log("Updated preferences:", JSON.stringify(updated, null, 2));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
