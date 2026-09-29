import crypto from "crypto";
import MetaAppCredential from "../models/metaAppCredential.model.js";

const IV_LENGTH = 12;

const getKey = () => {
    const value = process.env.ENCRYPTION_KEY;
    if (!value || value.length < 32) {
        throw new Error("ENCRYPTION_KEY must be at least 32 characters long");
    }
    return Buffer.from(value.slice(0, 32));
};

const encryptSecret = (value) => {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return `${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${encrypted.toString("hex")}`;
};

const decryptSecret = (value) => {
    const [ivHex, tagHex, encryptedHex] = value.split(":");
    if (!ivHex || !tagHex || !encryptedHex) throw new Error("Invalid encrypted Meta credential");
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return Buffer.concat([decipher.update(Buffer.from(encryptedHex, "hex")), decipher.final()]).toString("utf8");
};

export const getMetaOAuthConfig = async (platform, userId, credentialId) => {
    const config = {
        clientId: platform === "facebook" ? process.env.FACEBOOK_APP_ID : process.env.INSTAGRAM_APP_ID,
        clientSecret: platform === "facebook" ? process.env.FACEBOOK_APP_SECRET : process.env.INSTAGRAM_APP_SECRET,
        redirectUri: platform === "facebook"
            ? process.env.FACEBOOK_REDIRECT_URI || "https://social-sync-backend.vercel.app/api/social/facebook/callback"
            : process.env.INSTAGRAM_REDIRECT_URI || "https://social-sync-backend.vercel.app/api/social/instagram/callback"
    };

    if (!credentialId) return config;
    const credential = await MetaAppCredential.findOne({ _id: credentialId, userId, platform });
    if (!credential) throw new Error("Meta app credentials were not found for this user");

    return {
        clientId: decryptSecret(credential.encryptedClientId),
        clientSecret: decryptSecret(credential.encryptedClientSecret),
        redirectUri: credential.redirectUri
    };
};

export { encryptSecret, decryptSecret };