import MetaAppCredential from "../models/metaAppCredential.model.js";
import { encryptSecret } from "../utils/meta-credentials.js";

const platforms = new Set(["facebook", "instagram"]);

export const listMetaCredentials = async (req, res) => {
    const credentials = await MetaAppCredential.find({ userId: req.userId }).select("platform redirectUri createdAt updatedAt").lean();
    res.json({ success: true, credentials });
};

export const saveMetaCredential = async (req, res) => {
    const { platform, clientId, clientSecret } = req.body;
    if (!platforms.has(platform) || !clientId?.trim() || !clientSecret?.trim()) {
        return res.status(400).json({ success: false, message: "Platform, app ID, and app secret are required" });
    }

    const redirectUri = platform === "facebook"
        ? process.env.FACEBOOK_REDIRECT_URI || "https://social-sync-backend.vercel.app/api/social/facebook/callback"
        : process.env.INSTAGRAM_REDIRECT_URI || "https://social-sync-backend.vercel.app/api/social/instagram/callback";

    const credential = await MetaAppCredential.findOneAndUpdate(
        { userId: req.userId, platform },
        {
            userId: req.userId,
            platform,
            encryptedClientId: encryptSecret(clientId.trim()),
            encryptedClientSecret: encryptSecret(clientSecret.trim()),
            redirectUri
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).select("platform redirectUri createdAt updatedAt");

    res.json({ success: true, credential });
};

export const deleteMetaCredential = async (req, res) => {
    await MetaAppCredential.deleteOne({ userId: req.userId, platform: req.params.platform });
    res.json({ success: true });
};