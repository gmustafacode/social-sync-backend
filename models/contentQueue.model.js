import mongoose from "mongoose";

const contentQueueSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    source: { type: String, default: "manual" },
    contentType: { type: String, default: "text_only" },
    rawContent: { type: String },
    summary: { type: String },
    title: { type: String },
    mediaUrl: { type: String },
    status: { type: String, enum: ["pending","approved","review","rejected","ai_error"], default: "pending" },
    aiStatus: { type: String },
    finalScore: { type: Number },
    decisionReason: { type: String },
    analyzedAt: { type: Date }
}, { timestamps: true });

export default mongoose.model("ContentQueue", contentQueueSchema);
