import mongoose from "mongoose";

const postHistorySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    postId: { type: String },
    platform: { type: String, required: true },
    status: { type: String, enum: ["PUBLISHED","FAILED","PENDING"], default: "PUBLISHED" },
    postedAt: { type: Date, default: Date.now },
    externalPostId: { type: String },
    engagementMetrics: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

export default mongoose.model("PostHistory", postHistorySchema);
