import mongoose from "mongoose";

const aiLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    actionType: { type: String, required: true }, // e.g., "GENERATE_POST", "ANALYZE_TRENDS"
    prompt: { type: String },
    response: { type: String },
    modelUsed: { type: String }, // e.g., "llama3-8b-8192" or "gpt-4"
    status: { type: String, enum: ["success", "error"], default: "success" },
    errorMessage: { type: String }
}, { timestamps: true });

export default mongoose.model("AILog", aiLogSchema);
