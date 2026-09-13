import { PrismaClient } from '../lib/generated/prisma'
import { isTriggerDue, getNextContentType } from '../lib/automation-helper'

const db = new PrismaClient()

async function main() {
    console.log("--- Full Automation Engine Logic Verification ---");
    const email = 'developerssphere@gmail.com';
    const now = new Date();

    console.log("Current Time (UTC):", now.toISOString());
    console.log("Current Time (Local):", now.toString());

    // 1. Fetch preferences for the specific test user
    const targetUser = await db.preference.findUnique({
        where: { userId: '3ab52c6e-937a-4f03-9ce3-d0e4b7abdcd2' }
    });

    if (!targetUser) {
        console.log("CRITICAL: Test user preference record NOT found.");
        return;
    }

    if (targetUser.automationLevel !== 'Full Auto' && targetUser.automationLevel !== 'Semi-Auto') {
        console.log("Automation is not enabled for this user. Level:", targetUser.automationLevel);
        return;
    }

    console.log("User matched automation criteria.");
    console.log("Timezone:", targetUser.timezone);

    const schedule = typeof targetUser.postingSchedule === 'string'
        ? JSON.parse(targetUser.postingSchedule)
        : targetUser.postingSchedule;

    console.log("Schedule:", JSON.stringify(schedule));

    // 2. Test Trigger Match
    const isDue = isTriggerDue(schedule as any, targetUser.timezone, now);
    console.log("Is Trigger Due NOW?:", isDue);

    if (isDue) {
        // 3. Test Content Logic
        const nextContentType = await getNextContentType(targetUser.userId, targetUser.preferredContentTypes);
        console.log("Next Content Type:", nextContentType);

        // 4. Test Generation (Mocked or real check)
        const topic = `A ${nextContentType} post about ${targetUser.industryNiche || 'my industry'}`;
        console.log("Proposed Topic:", topic);
        console.log("SUCCESS: Everything is aligned for trigger execution.");
    } else {
        // Find current time in target TZ
        const tz = targetUser.timezone || 'UTC';
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            hour12: false,
            weekday: 'long',
            hour: 'numeric',
            minute: 'numeric'
        });
        const parts = formatter.formatToParts(now);
        const getV = (t: string) => parts.find(p => p.type === t)?.value;
        console.log(`Current Local Time in ${tz}: ${getV('weekday')} ${getV('hour')}:${getV('minute')}`);
        console.log("WAITING: Current time does not match schedule (plus/minus 2 mins).");
    }
}

main()
    .catch(console.error)
    .finally(() => db.$disconnect());
