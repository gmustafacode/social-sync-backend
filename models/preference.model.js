import mongoose from "mongoose";

const preferenceSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    autoApprove: { type: Boolean, default: false },
    schedulingEnabled: { type: Boolean, default: true },
    automationLevel: { type: String, default: "Semi-Auto" },
    preferredPlatforms: [{ type: String }],
    defaultPlatforms: [{ type: String }],
    platformPreferences: { type: mongoose.Schema.Types.Mixed, default: {} },
    audienceType: { type: String, default: "General" },
    contentTone: { type: String, default: "Professional" },
    captionLength: { type: String, default: "Medium" },
    hashtagIntensity: { type: String, default: "Medium" },
    useEmojis: { type: Boolean, default: true },
    preferredContentTypes: [{ type: String }],
    postingSchedule: { type: mongoose.Schema.Types.Mixed },
    industryNiche: { type: String },
    brandName: { type: String },
    contentGoals: [{ type: String }],
    scheduleStartDate: { type: String },
    scheduleEndDate: { type: String },
    selectedAccountIds: [{ type: String }],
    topicPreferences: [{ type: String }],
    excludedTopics: [{ type: String }],
    mediaPreference: { type: String, default: "ai_selected" },
    automationLastTriggerKey: { type: String },
    webhookUrl: { type: String },
    n8nWebhookUrl: { type: String },
    timezone: { type: String, default: "UTC" }
    , timezoneConfigured: { type: Boolean, default: false }
}, { timestamps: true, strict: false });

export default mongoose.model("Preference", preferenceSchema);
