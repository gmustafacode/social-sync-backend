import mongoose from "mongoose";

const aiProcessingLogSchema = new mongoose.Schema({
    batchId: { type: String, required: true },
    batchSize: { type: Number },
    processed: { type: Number, default: 0 },
    approved: { type: Number, default: 0 },
    review: { type: Number, default: 0 },
    rejected: { type: Number, default: 0 },
    aiErrors: { type: Number, default: 0 },
    executionTime: { type: Number },
    startedAt: { type: Date },
    finishedAt: { type: Date }
}, { timestamps: true });

export default mongoose.model("AIProcessingLog", aiProcessingLogSchema);
