import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const IV_LENGTH = 12; // GCM recommended IV length
const AUTH_TAG_LENGTH = 16; // GCM auth tag length

const getEncryptionKey = () => {
    if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
        if (process.env.NODE_ENV === 'production' || process.env.CI) {
            throw new Error("CRITICAL: ENCRYPTION_KEY must be set in environment variables and be at least 32 characters long.");
        }
        return "placeholder_key_for_build_purposes_only_32_chars";
    }
    return ENCRYPTION_KEY;
};

/**
 * Encrypts text using AES-256-GCM.
 * Format: iv (hex) + authTag (hex) + encryptedText (hex)
 */
export function encrypt(text: string): string {
    if (!text) return '';
    try {
        const key = Buffer.from(getEncryptionKey().slice(0, 32));
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');

        return iv.toString('hex') + ':' + authTag + ':' + encrypted;
    } catch (error: any) {
        console.error("[Encryption] Failed:", error);
        throw new Error(`Encryption failed: ${error.message}`);
    }
}

/**
 * Decrypts text using AES-256-GCM with backward compatibility for CBC.
 */
export function decrypt(text: string): string {
    if (!text) return '';
    try {
        const textParts = text.split(':');

        // Handle Legacy CBC (iv:encrypted)
        if (textParts.length === 2) {
            console.warn("[Encryption] Decrypting legacy CBC format. Token rotation recommended.");
            const key = Buffer.from(getEncryptionKey().slice(0, 32));
            const iv = Buffer.from(textParts[0], 'hex');
            const encryptedText = Buffer.from(textParts[1], 'hex');
            const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
            let decrypted = decipher.update(encryptedText);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            return decrypted.toString();
        }

        // Handle Modern GCM (iv:authTag:encrypted)
        if (textParts.length !== 3) throw new Error("Invalid encrypted text format");

        const key = Buffer.from(getEncryptionKey().slice(0, 32));
        const iv = Buffer.from(textParts[0], 'hex');
        const authTag = Buffer.from(textParts[1], 'hex');
        const encryptedText = textParts[2];

        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error: any) {
        console.error("[Decryption] Failed:", error);
        throw new Error(`Decryption failed: ${error.message}`);
    }
}

