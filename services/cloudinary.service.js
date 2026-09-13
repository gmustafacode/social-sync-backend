import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
    api_key: process.env.CLOUDINARY_API_KEY?.trim(),
    api_secret: process.env.CLOUDINARY_API_SECRET?.trim()
});

/**
 * Uploads media temporarily to Cloudinary in a designated temporary folder.
 * @param {Buffer|string} input - File buffer, local filepath, or external URL
 * @param {Object} options - Additional upload options (resource_type, filename, etc.)
 * @returns {Promise<{ secure_url: string, public_id: string, resource_type: string }>}
 */
export const uploadTemporaryMedia = async (input, options = {}) => {
    const resourceType = options.resourceType || options.resource_type || "auto";
    const folder = options.folder || "socialsync_temp";

    // If input is a Buffer, upload via upload_stream
    if (Buffer.isBuffer(input)) {
        return new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    folder,
                    resource_type: resourceType,
                    filename_override: options.filename || "upload"
                },
                (error, result) => {
                    if (error) {
                        console.error("[Cloudinary] Upload buffer failed:", error);
                        return reject(error);
                    }
                    console.log(`[Cloudinary] Temporary media uploaded: ${result.public_id} (${result.resource_type})`);
                    resolve({
                        secure_url: result.secure_url,
                        public_id: result.public_id,
                        resource_type: result.resource_type,
                        format: result.format,
                        bytes: result.bytes
                    });
                }
            );
            stream.end(input);
        });
    }

    // If input is a URL or file path string
    try {
        const result = await cloudinary.uploader.upload(input, {
            folder,
            resource_type: resourceType
        });
        console.log(`[Cloudinary] Temporary media uploaded from string/URL: ${result.public_id} (${result.resource_type})`);
        return {
            secure_url: result.secure_url,
            public_id: result.public_id,
            resource_type: result.resource_type,
            format: result.format,
            bytes: result.bytes
        };
    } catch (error) {
        console.error("[Cloudinary] Upload URL/path failed:", error);
        throw error;
    }
};

/**
 * Immediately deletes a temporary media item from Cloudinary by its public ID.
 * @param {string} publicId - Cloudinary public ID
 * @param {string} resourceType - 'image' or 'video' (default 'image')
 * @returns {Promise<boolean>}
 */
export const deleteTemporaryMedia = async (publicId, resourceType = "image") => {
    if (!publicId) return false;
    try {
        const result = await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType,
            invalidate: true
        });
        console.log(`[Cloudinary] Cleaned up temporary asset: ${publicId} -> result:`, result.result);
        return result.result === "ok" || result.result === "not found";
    } catch (error) {
        console.warn(`[Cloudinary] Error destroying temporary asset ${publicId}:`, error.message);
        return false;
    }
};

export default {
    uploadTemporaryMedia,
    deleteTemporaryMedia
};
