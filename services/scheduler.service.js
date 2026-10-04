import cron from "node-cron";
import ScheduledPost from "../models/scheduledPost.model.js";
import Post from "../models/post.model.js";
import Preference from "../models/preference.model.js";
import SocialAccount from "../models/socialAccount.model.js";
import { publishPost } from "./posting.service.js";
import { runIntelligenceLayer } from "./ai.service.js";

const MAX_RETRIES = 3;
const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const getLocalParts = (date, timeZone) => {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timeZone || "UTC",
        weekday: "long",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    }).formatToParts(date);
    const value = (type) => parts.find(part => part.type === type)?.value || "";
    const hour = Number(value("hour"));
    return {
        day: value("weekday"),
        date: `${value("year")}-${value("month")}-${value("day")}`,
        minutes: (hour === 24 ? 0 : hour) * 60 + Number(value("minute"))
    };
};

const parseScheduleTime = (value) => {
    if (typeof value !== "string") return null;
    const match = value.trim().match(/^(\d{1,2}):(\d{2})(?:\s*([ap]m))?$/i);
    if (!match) return null;
    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const meridiem = match[3]?.toLowerCase();
    if (minutes > 59 || hours > (meridiem ? 12 : 23) || hours < 0) return null;
    if (meridiem) hours = (hours % 12) + (meridiem === "pm" ? 12 : 0);
    return { hours, minutes };
};

const normalizeTriggers = (schedule) => {
    if (Array.isArray(schedule?.triggers)) return schedule.triggers;
    if (Array.isArray(schedule?.schedule)) return schedule.schedule;
    if (Array.isArray(schedule?.days) && Array.isArray(schedule?.times)) {
        return schedule.days.flatMap(day => schedule.times.map(time => ({ day, time })));
    }

    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return Object.entries(schedule || {}).flatMap(([day, value]) => {
        const normalizedDay = /^\d$/.test(day) ? dayNames[Number(day)] : day;
        if (!/^(Everyday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i.test(normalizedDay)) return [];
        return (Array.isArray(value) ? value : [value]).map(time => ({ day: normalizedDay, time }));
    });
};

const getDueTrigger = (postingSchedule, timeZone, now) => {
    const parsedSchedule = typeof postingSchedule === "string"
        ? JSON.parse(postingSchedule)
        : postingSchedule;
    const schedule = Array.isArray(parsedSchedule)
        ? { triggers: parsedSchedule }
        : (parsedSchedule || {});
    const triggers = normalizeTriggers(schedule);
    const local = getLocalParts(now, timeZone);
    if ((schedule.startDate && local.date < schedule.startDate) ||
        (schedule.endDate && local.date > schedule.endDate)) return null;

    const trigger = triggers.find(candidate => {
        if (!candidate?.time || (candidate.day?.toLowerCase() !== "everyday" && candidate.day?.toLowerCase() !== local.day.toLowerCase())) return false;
        const parsedTime = parseScheduleTime(candidate.time);
        if (!parsedTime) return false;
        const { hours, minutes } = parsedTime;
        const scheduledMinutes = hours * 60 + minutes;
        // Never consume a slot before its configured time. The grace period only
        // handles a delayed cron tick after the scheduled minute.
        return local.minutes >= scheduledMinutes && local.minutes <= scheduledMinutes + 5;
    });
    return trigger ? `${local.date}:${trigger.day}:${trigger.time}` : null;
};

const runRecurringAutomation = async () => {
    const now = new Date();
    const preferences = await Preference.find({
        automationLevel: { $in: [/^full auto$/i, /^semi-auto$/i] },
        postingSchedule: { $exists: true, $ne: null }
    }).lean();

    if (preferences.length > 0) {
        console.log(`[Automation] Evaluating ${preferences.length} recurring schedule(s) at ${now.toISOString()}`);
    }

    for (const preference of preferences) {
        let slotKey = null;
        let postsCreated = 0;
        try {
            if (preference.schedulingEnabled === false) continue;
            const storedSchedule = typeof preference.postingSchedule === "string"
                ? JSON.parse(preference.postingSchedule)
                : (preference.postingSchedule || {});
            const scheduleWithDates = Array.isArray(storedSchedule)
                ? {
                    triggers: storedSchedule,
                    startDate: preference.scheduleStartDate,
                    endDate: preference.scheduleEndDate
                }
                : {
                    ...storedSchedule,
                    startDate: storedSchedule.startDate || preference.scheduleStartDate,
                    endDate: storedSchedule.endDate || preference.scheduleEndDate
                };
            const local = getLocalParts(now, preference.timezone);
            slotKey = getDueTrigger(scheduleWithDates, preference.timezone, now);
            if (!slotKey) {
                console.log(`[Automation] Not due for ${preference.userId}: ${local.day} ${String(Math.floor(local.minutes / 60)).padStart(2, "0")}:${String(local.minutes % 60).padStart(2, "0")} ${preference.timezone || "UTC"}; triggers=${JSON.stringify(scheduleWithDates.triggers || scheduleWithDates.schedule || scheduleWithDates)}`);
            }
            if (!slotKey) continue;

            // This atomic claim makes repeated minute ticks and process restarts harmless.
            const claimed = await Preference.findOneAndUpdate(
                { _id: preference._id, automationLastTriggerKey: { $ne: slotKey } },
                { $set: { automationLastTriggerKey: slotKey } },
                { new: true }
            ).lean();
            if (!claimed) continue;

            console.log(`[Automation] Trigger detected for user ${preference.userId} (${slotKey})`);
            const niche = preference.industryNiche || "their industry";
            const topics = Array.isArray(preference.topicPreferences) ? preference.topicPreferences.join(", ") : "";
            const excluded = Array.isArray(preference.excludedTopics) ? preference.excludedTopics.join(", ") : "";
            const topic = `${niche} ${topics ? `with a focus on ${topics}` : "fresh practical insights"}${excluded ? `; avoid ${excluded}` : ""}`;
            const platforms = (preference.preferredPlatforms || ["linkedin"]).map(platform => platform.toLowerCase());
            const automationMode = String(preference.automationLevel || "").toLowerCase();
            const result = await runIntelligenceLayer(
                preference.userId,
                topic,
                preference.audienceType,
                preference.contentTone,
                preference.preferredContentTypes?.[0],
                platforms
            );
            console.log(`[Automation] AI content generated for user ${preference.userId}; platforms=${platforms.join(",")}`);

            if (!result?.safetyStatus?.isSafe) {
                console.warn(`[Automation] Safety check failed for user ${preference.userId}`);
                await Preference.updateOne({ _id: preference._id, automationLastTriggerKey: slotKey }, { $unset: { automationLastTriggerKey: 1 } });
                continue;
            }

            if (automationMode === "semi-auto") {
                const firstPlatform = platforms[0];
                await import("../models/contentQueue.model.js").then(({ default: ContentQueue }) => ContentQueue.create({
                    userId: preference.userId,
                    source: "automation",
                    contentType: "text_only",
                    rawContent: result.platformContent?.[firstPlatform]?.text || result.rawContent,
                    title: `Automation review: ${topic}`,
                    status: "pending"
                }));
                continue;
            }

            if (automationMode !== "full auto") {
                console.warn(`[Automation] Unsupported automation mode for user ${preference.userId}: ${preference.automationLevel}`);
                continue;
            }

            const selectedIds = new Set(preference.selectedAccountIds || []);
            const requestedType = String(preference.preferredContentTypes?.[0] || "text").toLowerCase();
            const postType = requestedType.includes("image") ? "IMAGE" : requestedType.includes("video") ? "VIDEO" : "TEXT";
            for (const platform of platforms) {
                const account = await SocialAccount.findOne({
                    _id: selectedIds.size ? { $in: [...selectedIds] } : { $exists: true },
                    userId: { $in: [preference.userId, preference.userId?.toString()] },
                    platform: { $regex: new RegExp(`^${platform}$`, "i") },
                    $or: [{ status: "active" }, { status: { $exists: false }, isConnected: { $ne: false } }]
                }).lean();
                if (!account) {
                    console.warn(`[Automation] No selected active ${platform} account for user ${preference.userId}`);
                    continue;
                }

                const contentText = result.platformContent?.[platform]?.text || result.rawContent || "";
                await ScheduledPost.create({
                    userId: preference.userId,
                    socialAccountId: account._id,
                    platform,
                    postType,
                    contentText,
                    platformContent: result.platformContent || {},
                    status: "pending",
                    scheduledAt: now,
                    timezone: preference.timezone || "UTC",
                    automationTriggerKey: `${slotKey}:${platform}:${account._id}`
                });
                postsCreated += 1;
                console.log(`[Automation] Post created for user ${preference.userId}: ${platform}/${account._id}`);
            }
        } catch (error) {
            console.error(`[Automation] Trigger failed for user ${preference.userId}:`, error.message);
            // A failed generation or account lookup must not permanently consume
            // the slot. Keep successful multi-platform posts idempotent by only
            // releasing the claim when this run created nothing.
            if (typeof slotKey !== "undefined" && !postsCreated) {
                await Preference.updateOne({ _id: preference._id, automationLastTriggerKey: slotKey }, { $unset: { automationLastTriggerKey: 1 } }).catch(() => { });
            }
        }
    }
};

/**
 * Recovers any posts stuck in 'processing' state (e.g. from server restart or crash).
 */
export const recoverZombieJobs = async () => {
    try {
        const threshold = new Date(Date.now() - LOCK_TIMEOUT_MS);
        const stuckPosts = await ScheduledPost.find({
            status: "processing",
            $or: [
                { lockedAt: { $lt: threshold } },
                { lockedAt: { $exists: false } }
            ]
        });

        if (stuckPosts.length > 0) {
            console.log(`[Scheduler] Found ${stuckPosts.length} hung processing job(s). Recovering...`);
            for (const post of stuckPosts) {
                if ((post.retryCount || 0) < MAX_RETRIES) {
                    post.status = "pending";
                    post.retryCount = (post.retryCount || 0) + 1;
                    post.lastError = "Recovered from hung processing state";
                    await post.save();
                    console.log(`[Scheduler] Reset stuck post ${post._id} to pending (attempt ${post.retryCount})`);
                } else {
                    post.status = "failed";
                    post.lastError = "Exceeded retry threshold while in hung processing state";
                    await post.save();
                    console.log(`[Scheduler] Marked stuck post ${post._id} as failed (exceeded retries)`);
                }
            }
        }
    } catch (err) {
        console.error("[Scheduler] Error recovering zombie jobs:", err.message);
    }
};

// ─── Cron: every minute — publish due scheduled posts with atomic lock ────────
cron.schedule("* * * * *", async () => {
    try {
        await runRecurringAutomation();

        const now = new Date();

        // 1. Find candidates that are pending and due
        const candidates = await ScheduledPost.find({
            status: "pending",
            scheduledAt: { $lte: now }
        }).select("_id").lean();

        if (!candidates.length) return;
        console.log(`[Scheduler] ${candidates.length} post(s) candidates due for publishing`);

        for (const candidate of candidates) {
            // 2. ATOMIC LOCK: Claim the job atomically
            const post = await ScheduledPost.findOneAndUpdate(
                { _id: candidate._id, status: "pending" },
                {
                    $set: {
                        status: "processing",
                        lockedAt: new Date()
                    }
                },
                { new: true }
            ).populate("socialAccountId");

            // If another worker or instance already locked it, skip
            if (!post) {
                console.log(`[Scheduler] Post ${candidate._id} already claimed by another worker. Skipping.`);
                continue;
            }

            try {
                console.log(`[Scheduler] Processing post ${post._id} for ${post.platform}...`);
                const result = await publishPost(post);

                post.status = "published";
                post.publishedAt = new Date();
                post.externalPostId = result?.id || null;
                post.lastError = null;
                await post.save();
                console.log(`[Scheduler] Successfully published post ${post._id} -> ${post.platform} (ID: ${result?.id})`);

                // Also update or record in unified Post collection
                try {
                    await Post.updateOne(
                        {
                            userId: post.userId,
                            contentText: post.contentText,
                            status: { $in: ["scheduled", "pending", "draft"] }
                        },
                        {
                            $set: {
                                status: "published",
                                platformPostId: result?.id,
                                publishedAt: new Date()
                            }
                        }
                    );
                } catch (e) {
                    // non-fatal
                }
            } catch (err) {
                console.error(`[Scheduler] Failed post ${post._id}:`, err.message);
                const currentRetries = (post.retryCount || 0) + 1;
                post.retryCount = currentRetries;
                post.lastError = err.message;

                if (currentRetries < MAX_RETRIES) {
                    // Exponential / incremental backoff: retry in 2 minutes
                    post.status = "pending";
                    post.scheduledAt = new Date(Date.now() + 2 * 60 * 1000);
                    console.log(`[Scheduler] Post ${post._id} scheduled for retry ${currentRetries}/${MAX_RETRIES} in 2m`);
                } else {
                    post.status = "failed";
                    console.log(`[Scheduler] Post ${post._id} marked as failed after ${MAX_RETRIES} retries`);
                }

                await post.save();
            }
        }
    } catch (err) {
        console.error("[Scheduler] Cron error:", err.message);
    }
});

// ─── Cron: every 10 min — Zombie Job Recovery ────────────────────────────────
cron.schedule("*/10 * * * *", async () => {
    await recoverZombieJobs();
});

// ─── Cron: every 30 min — AI batch content analysis ──────────────────────────
cron.schedule("*/30 * * * *", async () => {
    try {
        const { processBatch } = await import("./ai.service.js");
        const stats = await processBatch(10);
        if (stats.processed > 0) console.log("[Scheduler] AI batch done:", stats);
    } catch (err) {
        console.error("[Scheduler] AI batch error:", err.message);
    }
});

// Run immediate recovery on boot
recoverZombieJobs();

console.log("[Scheduler] Cron service initialized (atomic locking, zombie recovery, post scheduler + AI batch).");
