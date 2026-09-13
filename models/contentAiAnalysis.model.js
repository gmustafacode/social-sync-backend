import mongoose from "mongoose";

const contentAiAnalysisSchema = new mongoose.Schema({
    contentId: { type: mongoose.Schema.Types.ObjectId, ref: "ContentQueue", unique: true, required: true },
    category: { type: String },
    contentQualityScore: { type: Number },
    engagementScore: { type: Number },
    viralityProbability: { type: Number },
    finalScore: { type: Number },
    recommendedPlatforms: [{ type: String }],
    contentTypeRecommendation: { type: String },
    rewriteNeeded: { type: Boolean },
    reasoning: { type: String },
    rawLlmResponse: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

export default mongoose.model("ContentAiAnalysis", contentAiAnalysisSchema);
