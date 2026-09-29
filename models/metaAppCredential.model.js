import mongoose from "mongoose";

const metaAppCredentialSchema = new mongoose.Schema(
    {
        userId: { type: String, required: true, index: true },
        platform: { type: String, enum: ["facebook", "instagram"], required: true },
        encryptedClientId: { type: String, required: true },
        encryptedClientSecret: { type: String, required: true },
        redirectUri: { type: String, required: true }
    },
    { timestamps: true }
);

metaAppCredentialSchema.index({ userId: 1, platform: 1 }, { unique: true });

export default mongoose.model("MetaAppCredential", metaAppCredentialSchema);