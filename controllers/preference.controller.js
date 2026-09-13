import Preference from "../models/preference.model.js";

const VALID_MODES = new Set(["Manual", "Semi-Auto", "Full Auto"]);
const VALID_PLATFORMS = new Set(["linkedin", "facebook", "instagram", "x"]);

function validateAutomationPayload(body) {
    const mode = body.automationLevel;
    if (mode !== undefined && !VALID_MODES.has(mode)) {
        throw new Error("Invalid automation mode");
    }

    if (body.timezone !== undefined) {
        try {
            new Intl.DateTimeFormat("en-US", { timeZone: body.timezone }).format();
        } catch {
            throw new Error("Invalid timezone");
        }
    }

    if (body.postingSchedule !== undefined) {
        const schedule = typeof body.postingSchedule === "string"
            ? JSON.parse(body.postingSchedule)
            : body.postingSchedule;
        const triggers = Array.isArray(schedule) ? schedule : schedule?.triggers;
        if (!Array.isArray(triggers) || triggers.length === 0) {
            throw new Error("At least one schedule time is required");
        }
        for (const trigger of triggers) {
            if (!/^(Everyday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/.test(trigger.day) ||
                !/^([01]\d|2[0-3]):[0-5]\d$/.test(trigger.time)) {
                throw new Error("Schedule contains an invalid day or time");
            }
        }
        const startDate = Array.isArray(schedule) ? undefined : schedule.startDate;
        const endDate = Array.isArray(schedule) ? undefined : schedule.endDate;
        if (startDate && endDate && endDate < startDate) {
            throw new Error("End date cannot be before start date");
        }
        if (mode === "Full Auto" && (!body.preferredPlatforms || body.preferredPlatforms.length === 0)) {
            throw new Error("Full Auto requires at least one platform");
        }
    }

    if (body.preferredPlatforms && body.preferredPlatforms.some((platform) => !VALID_PLATFORMS.has(platform))) {
        throw new Error("Unsupported platform selected");
    }
}

function normalizeContentGoals(value) {
    if (Array.isArray(value)) return value.filter(goal => typeof goal === "string" && goal.trim());
    if (typeof value === "string" && value.trim()) return [value.trim()];
    return value;
}

// GET /api/preferences
export const getPreferences = async (req, res) => {
    try {
        const userId = req.userId;
        let prefs = await Preference.findOne({ userId }).lean();

        if (!prefs) {
            // Default initial preferences
            prefs = {
                userId,
                autoApprove: false,
                schedulingEnabled: true,
                automationLevel: "Semi-Auto",
                preferredPlatforms: ["linkedin", "x"],
                defaultPlatforms: ["linkedin", "x"],
                audienceType: "General",
                contentTone: "Professional",
                captionLength: "Medium",
                hashtagIntensity: "Medium",
                useEmojis: true,
                timezone: "UTC",
                n8nWebhookUrl: process.env.N8N_PUBLISH_WEBHOOK_URL || ""
            };
        }

        res.status(200).json({
            success: true,
            autoApprove: prefs.autoApprove ?? false,
            schedulingEnabled: prefs.schedulingEnabled ?? true,
            defaultPlatforms: prefs.defaultPlatforms || prefs.preferredPlatforms || [],
            webhookUrl: prefs.webhookUrl || "",
            n8nWebhookUrl: prefs.n8nWebhookUrl || process.env.N8N_PUBLISH_WEBHOOK_URL || "",
            ...prefs,
            preferences: prefs
        });
    } catch (error) {
        console.error("[Preferences Error]:", error);
        res.status(500).json({ success: false, message: "Failed to fetch preferences", error: error.message });
    }
};

// PUT /api/preferences
export const updatePreferences = async (req, res) => {
    try {
        const userId = req.userId;
        const updateData = req.body;
        validateAutomationPayload(updateData);
        updateData.contentGoals = normalizeContentGoals(updateData.contentGoals);

        if (updateData.postingSchedule && typeof updateData.postingSchedule === "string") {
            updateData.postingSchedule = JSON.parse(updateData.postingSchedule);
        }

        const updated = await Preference.findOneAndUpdate(
            { userId },
            { $set: updateData },
            { new: true, upsert: true }
        ).lean();

        res.status(200).json({
            success: true,
            message: "Preferences updated successfully",
            autoApprove: updated.autoApprove ?? false,
            schedulingEnabled: updated.schedulingEnabled ?? true,
            defaultPlatforms: updated.defaultPlatforms || updated.preferredPlatforms || [],
            webhookUrl: updated.webhookUrl || "",
            n8nWebhookUrl: updated.n8nWebhookUrl || process.env.N8N_PUBLISH_WEBHOOK_URL || "",
            ...updated,
            preferences: updated
        });
    } catch (error) {
        console.error("[Preferences Update Error]:", error);
        const status = /Invalid|requires|cannot be|At least/.test(error.message) ? 400 : 500;
        res.status(status).json({ success: false, message: error.message || "Failed to update preferences" });
    }
};
