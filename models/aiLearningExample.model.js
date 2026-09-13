import mongoose from "mongoose";

const aiLearningExampleSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    postId: { type: String },
    contentText: { type: String },
    sentimentScore: { type: Number, default: 50 },
    category: { type: String, enum: ["positive","negative","neutral"], default: "neutral" },
    keyLearnings: { type: String }
}, { timestamps: true });

export default mongoose.model("AILearningExample", aiLearningExampleSchema);
