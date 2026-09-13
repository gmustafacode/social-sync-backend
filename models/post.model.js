import mongoose from "mongoose";

const postSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    socialAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "SocialAccount" },
    platform: { type: String, default: "general" },
    platforms: [{ type: String }],
    
    postType: { type: String, default: "TEXT" },
    contentText: { type: String, required: true },
    content: { type: String },
    mediaUrls: [{ type: String }],
    
    targetType: { type: String, default: "FEED" },
    targetId: { type: String },
    visibility: { type: String, default: "PUBLIC" },
    
    status: { 
        type: String, 
        enum: ["draft", "scheduled", "processing", "published", "failed", "queued", "approved", "rejected"], 
        default: "draft" 
    },
    scheduledAt: { type: Date },
    timezone: { type: String, default: "UTC" },
    
    platformPostId: { type: String },
    lastError: { type: String }
}, { timestamps: true, strict: false });

postSchema.pre("validate", function(next) {
    if (!this.contentText && this.content) {
        this.contentText = this.content;
    }
    if (!this.content && this.contentText) {
        this.content = this.contentText;
    }
    next();
});

export default mongoose.model("Post", postSchema);
