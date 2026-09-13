import crypto from "crypto";

const IV_LENGTH = 12; // GCM recommended IV length
const AUTH_TAG_LENGTH = 16; // GCM auth tag length

const getEncryptionKey = () => {
    const key = process.env.ENCRYPTION_KEY;
    if (!key || key.length < 32) {
        return "placeholder_key_for_build_purposes_only_32_chars";
    }
    return key;
};

/**
 * Encrypts text using AES-256-GCM.
 * Format: iv (hex) + authTag (hex) + encryptedText (hex)
 */
export function encrypt(text) {
    if (!text) return "";
    try {
        const key = Buffer.from(getEncryptionKey().slice(0, 32));
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

        let encrypted = cipher.update(text, "utf8", "hex");
        encrypted += cipher.final("hex");
        const authTag = cipher.getAuthTag().toString("hex");

        return iv.toString("hex") + ":" + authTag + ":" + encrypted;
    } catch (error) {
        console.error("[Encryption] Failed:", error);
        throw new Error(`Encryption failed: ${error.message}`);
    }
}

/**
 * Decrypts text using AES-256-GCM.
 */
export function decrypt(text) {
    if (!text) return "";
    try {
        const textParts = text.split(":");

        // Handle Legacy CBC (iv:encrypted) from older versions if any
        if (textParts.length === 2) {
            const key = Buffer.from(getEncryptionKey().slice(0, 32));
            const iv = Buffer.from(textParts[0], "hex");
            const encryptedText = Buffer.from(textParts[1], "hex");
            const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
            let decrypted = decipher.update(encryptedText);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            return decrypted.toString();
        }

        if (textParts.length !== 3) throw new Error("Invalid encrypted text format");

        const key = Buffer.from(getEncryptionKey().slice(0, 32));
        const iv = Buffer.from(textParts[0], "hex");
        const authTag = Buffer.from(textParts[1], "hex");
        const encryptedText = textParts[2];

        const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedText, "hex", "utf8");
        decrypted += decipher.final("utf8");

        return decrypted;
    } catch (error) {
        console.error("[Decryption] Failed:", error);
        throw new Error(`Decryption failed: ${error.message}`);
    }
}
