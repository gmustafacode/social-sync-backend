import db from "./db";

export interface ScheduleTrigger {
    day: string; // 'Everyday', 'Monday', 'Tuesday', ...
    time: string; // 'HH:mm'
}

export interface AutomationSchedule {
    triggers: ScheduleTrigger[];
    startDate?: string | null;
    endDate?: string | null;
    frequency?: string | null;
}

export function normalizeSchedule(schedule: ScheduleTrigger[] | AutomationSchedule | null | undefined): AutomationSchedule {
    if (Array.isArray(schedule)) return { triggers: schedule };
    return {
        triggers: Array.isArray(schedule?.triggers) ? schedule.triggers : [],
        startDate: schedule?.startDate || null,
        endDate: schedule?.endDate || null,
        frequency: schedule?.frequency || null
    };
}

function isWithinDateRange(schedule: AutomationSchedule, now: Date, timeZone: string): boolean {
    const day = new Intl.DateTimeFormat('en-CA', {
        timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(now);
    return (!schedule.startDate || day >= schedule.startDate) &&
        (!schedule.endDate || day <= schedule.endDate);
}

/**
 * Checks if any of the triggers match the current time (UTC).
 * Supports ±2 minute fuzzy matching to account for potential cron delays.
 */
export function isTriggerDue(triggers: ScheduleTrigger[] | AutomationSchedule, userTimezone?: string | null, now: Date = new Date()): boolean {
    const schedule = normalizeSchedule(triggers);
    const tz = userTimezone || 'UTC';
    if (schedule.triggers.length === 0 || !isWithinDateRange(schedule, now, tz)) return false;

    // Default to UTC if no timezone provided
    // Get current day and time in the user's timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour12: false,
        weekday: 'long',
        hour: 'numeric',
        minute: 'numeric'
    });

    const parts = formatter.formatToParts(now);
    const getValue = (type: string) => parts.find(p => p.type === type)?.value;

    const currentDay = getValue('weekday');
    const hours = parseInt(getValue('hour') || '0');
    const minutes = parseInt(getValue('minute') || '0');
    const currentTotalMinutes = hours * 60 + minutes;

    for (const trigger of schedule.triggers) {
        if (!trigger.time) continue;

        // Check day match
        if (trigger.day !== 'Everyday' && trigger.day !== currentDay) continue;

        // Parse trigger time HH:mm
        const [tHours, tMinutes] = trigger.time.split(':').map(Number);
        if (isNaN(tHours) || isNaN(tMinutes)) continue;

        const triggerTotalMinutes = tHours * 60 + tMinutes;

        // ±5 minute fuzzy match (more resilient to cron/poll delays)
        const diff = Math.abs(currentTotalMinutes - triggerTotalMinutes);

        // Handle midnight wraparound
        if (diff <= 5 || diff >= 1435) {
            return true;
        }
    }

    return false;
}

/** Returns the local calendar slot that is currently due, for durable idempotency. */
export function getTriggerSlotKey(
    triggers: ScheduleTrigger[] | AutomationSchedule,
    userTimezone?: string | null,
    now: Date = new Date()
): string | null {
    const schedule = normalizeSchedule(triggers);
    const tz = userTimezone || 'UTC';
    if (schedule.triggers.length === 0 || !isWithinDateRange(schedule, now, tz)) return null;
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
        weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false
    });
    const parts = formatter.formatToParts(now);
    const value = (type: string) => parts.find(part => part.type === type)?.value || '';
    const localDate = `${value('year')}-${value('month')}-${value('day')}`;
    const currentDay = value('weekday');
    const currentMinutes = Number(value('hour')) * 60 + Number(value('minute'));
    const trigger = schedule.triggers.find(candidate => {
        if (candidate.day !== 'Everyday' && candidate.day !== currentDay) return false;
        const [hours, minutes] = candidate.time.split(':').map(Number);
        const difference = Math.abs(currentMinutes - (hours * 60 + minutes));
        return Number.isFinite(hours) && Number.isFinite(minutes) && (difference <= 5 || difference >= 1435);
    });
    return trigger ? `${localDate}:${trigger.day}:${trigger.time}` : null;
}

/**
 * Determines the next content type in the user's preferred sequence.
 * Looks at the last generated content in the queue and sequentially selects the next preference.
 */
export async function getNextContentType(userId: string, preferredTypes: string[]): Promise<string> {
    if (!preferredTypes || preferredTypes.length === 0) {
        return 'text'; // Default fallback
    }

    if (preferredTypes.length === 1) {
        return preferredTypes[0];
    }

    // Attempt to find the most recently created content for this user
    const lastContent = await db.contentQueue.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { contentType: true }
    });

    if (!lastContent || !lastContent.contentType) {
        return preferredTypes[0]; // First time or no history
    }

    const currentType = lastContent.contentType.toLowerCase();

    // Check if the current type is still one of our preferences
    const currentIndex = preferredTypes.findIndex(t => t.toLowerCase() === currentType);

    if (currentIndex === -1) {
        return preferredTypes[0]; // Pattern changed or type removed
    }

    const nextIndex = (currentIndex + 1) % preferredTypes.length;
    return preferredTypes[nextIndex];
}

/**
 * Calculates the exact Date of the next upcoming trigger from the user's schedule.
 */
export function getNextTriggerTime(triggers: ScheduleTrigger[], userTimezone?: string | null, fromDate: Date = new Date()): Date | null {
    if (!triggers || !Array.isArray(triggers) || triggers.length === 0) return null;

    const tz = userTimezone || 'UTC';
    let nextDate: Date | null = null;
    let minDiffMs = Infinity;

    for (const trigger of triggers) {
        if (!trigger.time) continue;
        const [hours, minutes] = trigger.time.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) continue;

        // Check for the next 8 days to guarantee we find the next occurrence
        for (let i = 0; i <= 7; i++) {
            // 1. Get the date part for 'i' days from now in the target timezone
            const targetDate = new Date(fromDate.getTime() + i * 24 * 60 * 60 * 1000);
            const dateISO = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD

            // 2. We want to find the UTC time such that its local representation is HH:mm
            const candidateUTC = new Date(`${dateISO}T${trigger.time}:00Z`); // Assume UTC for now

            // Now adjust for the timezone offset at that specific time
            const getLocalOffset = (date: Date, timeZone: string) => {
                const parts = new Intl.DateTimeFormat('en-US', {
                    timeZone,
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                    hour12: false
                }).formatToParts(date);
                const getV = (t: string) => parts.find(p => p.type === t)?.value;
                const localStr = `${getV('year')}-${getV('month')}-${getV('day')}T${getV('hour')}:${getV('minute')}:${getV('second')}Z`;
                const localDate = new Date(localStr);
                return (localDate.getTime() - date.getTime());
            };

            const offset = getLocalOffset(candidateUTC, tz);
            const finalCandidate = new Date(candidateUTC.getTime() - offset);

            // 3. Verify the Day matches in that timezone
            const dayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' });
            const candidateDay = dayFormatter.format(finalCandidate);

            if (trigger.day === 'Everyday' || trigger.day === candidateDay) {
                const diffMs = finalCandidate.getTime() - fromDate.getTime();
                // Must be strictly in the future
                if (diffMs > 0 && diffMs < minDiffMs) {
                    minDiffMs = diffMs;
                    nextDate = finalCandidate;
                }
            }
        }
    }

    return nextDate;
}
