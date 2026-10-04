import mongoose from "mongoose";

const scheduledPostSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    socialAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "SocialAccount" },
    platform: { type: String, required: true },
    postType: { type: String, default: "TEXT" },
    contentText: { type: String, required: true },
    platformContent: { type: mongoose.Schema.Types.Mixed, default: {} },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    hashtags: [{ type: String }],
    keywords: [{ type: String }],
    seoTitle: { type: String },
    seoDescription: { type: String },
    altText: { type: String },
    mediaUrl: { type: String },
    targetType: { type: String, default: "FEED" },
    targetId: { type: String },
    status: { type: String, enum: ["pending", "processing", "published", "failed", "draft", "scheduled"], default: "pending" },
    scheduledAt: { type: Date },
    publishedAt: { type: Date },
    externalPostId: { type: String },
    contentId: { type: mongoose.Schema.Types.ObjectId },
    retryCount: { type: Number, default: 0 },
    lastError: { type: String },
    timezone: { type: String, default: "UTC" }
    , automationTriggerKey: { type: String }
}, { timestamps: true });

scheduledPostSchema.index(
    { userId: 1, automationTriggerKey: 1, platform: 1, socialAccountId: 1 },
    { unique: true, sparse: true }
);

export default mongoose.model("ScheduledPost", scheduledPostSchema);
