import { PrismaClient } from '../lib/generated/prisma'
import { isTriggerDue, getNextContentType } from '../lib/automation-helper'

const db = new PrismaClient()

async function simulate() {
    console.log("--- Automation Engine Simulation ---");
    const now = new Date();
    // Simulate Pakistan Time (PKT is UTC+5)
    // If it's 14:35 PKT, UTC is 09:35
    // Let's test for the user's current actual UTC time as well
    console.log("Actual UTC Time:", now.toISOString());
    console.log("Actual Local (System) Time:", now.toString());

    // 1. Fetch preferences (Replicating automationEngine logic)
    const preferences = await db.preference.findMany({
        where: {
            automationLevel: { in: ['Full Auto', 'Semi-Auto'] },
            postingSchedule: { not: { equals: null } }
        }
    });

    console.log(`Found ${preferences.length} automated users.`);

    for (const pref of preferences) {
        if (pref.userId === '3ab52c6e-937a-4f03-9ce3-d0e4b7abdcd2') {
            console.log(`\nEvaluating User: developerssphere@gmail.com (${pref.userId})`);
            console.log("Automation Level:", pref.automationLevel);
            console.log("Timezone (DB):", pref.timezone);

            const schedule = typeof pref.postingSchedule === 'string'
                ? JSON.parse(pref.postingSchedule)
                : pref.postingSchedule;

            console.log("Schedule:", JSON.stringify(schedule));

            const isDue = isTriggerDue(schedule as any, pref.timezone, now);
            console.log("Is Due Now?:", isDue);

            if (isDue) {
                const nextContentType = await getNextContentType(pref.userId, pref.preferredContentTypes);
                console.log("Next Content Type:", nextContentType);
                console.log("Sequence Logic OK.");
            } else {
                // Find when it SHOULD be due
                const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                const tz = pref.timezone || 'UTC';
                const formatter = new Intl.DateTimeFormat('en-US', {
                    timeZone: tz,
                    hour12: false,
                    weekday: 'long',
                    hour: 'numeric',
                    minute: 'numeric'
                });
                const parts = formatter.formatToParts(now);
                console.log("Current formatted in user TZ:", parts.map(p => `${p.type}: ${p.value}`).join(', '));
            }
        }
    }
}

simulate()
    .catch(console.error)
    .finally(() => db.$disconnect());
