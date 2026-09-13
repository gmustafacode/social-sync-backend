
import db from "@/lib/db";

export const OPS_LIMITS = {
    LINKEDIN: {
        DAILY_POSTS: 25,     // Safe limit for personal profiles to avoid spam flags
        MIN_INTERVAL_MINUTES: 15 // Force 15 min gap between posts
    },
    X: {
        DAILY_POSTS: 25,
        MIN_INTERVAL_MINUTES: 5
    },
    REDDIT: {
        DAILY_POSTS: 10,
        MIN_INTERVAL_MINUTES: 5
    }
};

/**
 * Checks if a user has exceeded their posting limits for a given platform.
 * Returns { allowed: true } or { allowed: false, error: "Reason" }
 */
export async function checkPostingLimits(userId: string, platform: string = 'linkedin'): Promise<{ allowed: boolean, error?: string }> {
    try {
        const now = new Date();
        const normalizedPlatform = platform.toLowerCase();

        // 1. Check Daily Limit (UTC Boundary)
        const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
        const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

        const dailyCount = await db.postHistory.count({
            where: {
                userId,
                platform: { equals: normalizedPlatform, mode: 'insensitive' },
                postedAt: {
                    gte: todayStart,
                    lte: todayEnd
                },
                status: 'PUBLISHED'
            }
        });

        const platformKey = normalizedPlatform.toUpperCase();
        const limit = (OPS_LIMITS as any)[platformKey]?.DAILY_POSTS || 20;

        if (dailyCount >= limit) {
            return { allowed: false, error: `Daily limit of ${limit} posts reached for ${normalizedPlatform} (UTC day).` };
        }

        // 2. Check recent posts (Spam Protection)
        const lastPost = await db.postHistory.findFirst({
            where: {
                userId,
                platform: { equals: normalizedPlatform, mode: 'insensitive' },
            },
            orderBy: { postedAt: 'desc' }
        });

        if (lastPost) {
            const minInterval = (OPS_LIMITS as any)[platformKey]?.MIN_INTERVAL_MINUTES || 5;
            const postedDate = new Date(lastPost.postedAt);
            const nextAllowedTime = new Date(postedDate.getTime() + minInterval * 60000);

            if (now < nextAllowedTime) {
                const minutesLeft = Math.ceil((nextAllowedTime.getTime() - now.getTime()) / 60000);
                return { allowed: false, error: `Rate limit: Please wait ${minutesLeft} minutes before posting again.` };
            }
        }

        return { allowed: true };

    } catch (error) {
        console.error("Error checking limits:", error);
        // Fail open or closed? Fail closed for safety.
        return { allowed: false, error: "System error checking limits." };
    }
}

/**
 * Gets the current limit status for a user to display on the Frontend UI.
 */
export async function getUserLimits(userId: string, platform: string = 'linkedin') {
    try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        const dailyCount = await db.postHistory.count({
            where: {
                userId,
                platform: { equals: platform, mode: 'insensitive' },
                postedAt: { gte: todayStart, lte: todayEnd },
                status: 'PUBLISHED'
            }
        });

        const limit = (OPS_LIMITS as any)[platform.toUpperCase()]?.DAILY_POSTS || 25;
        const minInterval = (OPS_LIMITS as any)[platform.toUpperCase()]?.MIN_INTERVAL_MINUTES || 5;

        const lastPost = await db.postHistory.findFirst({
            where: { userId, platform: { equals: platform, mode: 'insensitive' } },
            orderBy: { postedAt: 'desc' }
        });

        let nextPostAvailableAt = now;
        let isRateLimited = false;
        if (lastPost) {
            const postedDate = new Date(lastPost.postedAt);
            const nextAllowedTime = new Date(postedDate.getTime() + minInterval * 60000);
            if (now < nextAllowedTime) {
                isRateLimited = true;
                nextPostAvailableAt = nextAllowedTime;
            }
        }

        return {
            platform,
            used: dailyCount,
            limit,
            percentage: Math.min(100, Math.round((dailyCount / limit) * 100)),
            isRateLimited,
            nextPostAvailableAt: nextPostAvailableAt.toISOString(),
            exhausted: dailyCount >= limit
        };

    } catch (e) {
        console.error("Failed to fetch user limits:", e);
        return {
            platform,
            used: 0,
            limit: 25,
            percentage: 0,
            isRateLimited: false,
            nextPostAvailableAt: new Date().toISOString(),
            exhausted: false
        };
    }
}
