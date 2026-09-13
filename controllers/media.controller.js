import axios from "axios";
import { uploadTemporaryMedia, deleteTemporaryMedia } from "../services/cloudinary.service.js";

/**
 * Search royalty-free photos via Unsplash API
 * GET /api/media/unsplash
 */
export const searchUnsplash = async (req, res) => {
    try {
        const { query = "technology", page = 1, perPage = 12 } = req.query;
        const accessKey = process.env.UNSPLASH_ACCESS_KEY?.trim();

        if (!accessKey) {
            return res.status(500).json({ success: false, message: "Unsplash access key not configured" });
        }

        const response = await axios.get("https://api.unsplash.com/search/photos", {
            params: {
                query,
                page: Number(page),
                per_page: Number(perPage),
                orientation: "landscape"
            },
            headers: {
                Authorization: `Client-ID ${accessKey}`
            }
        });

        const photos = (response.data.results || []).map((photo) => ({
            id: photo.id,
            source: "unsplash",
            previewUrl: photo.urls.small,
            fullUrl: photo.urls.regular,
            thumbUrl: photo.urls.thumb,
            downloadUrl: photo.links.download_location,
            width: photo.width,
            height: photo.height,
            description: photo.description || photo.alt_description || "Unsplash Photo",
            author: {
                name: photo.user?.name || "Photographer",
                username: photo.user?.username,
                link: photo.user?.links?.html
            }
        }));

        res.status(200).json({
            success: true,
            total: response.data.total,
            totalPages: response.data.total_pages,
            page: Number(page),
            photos,
            results: photos
        });
    } catch (error) {
        console.error("[Unsplash Error]:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            message: "Failed to search Unsplash photos",
            error: error.response?.data?.errors?.[0] || error.message
        });
    }
};

/**
 * Search royalty-free photos via Pexels API
 * GET /api/media/pexels
 */
export const searchPexels = async (req, res) => {
    try {
        const { query = "business", page = 1, perPage = 12 } = req.query;
        const apiKey = process.env.PEXELS_API_KEY?.trim();

        if (!apiKey) {
            return res.status(500).json({ success: false, message: "Pexels API key not configured" });
        }

        const response = await axios.get("https://api.pexels.com/v1/search", {
            params: {
                query,
                page: Number(page),
                per_page: Number(perPage),
                orientation: "landscape"
            },
            headers: {
                Authorization: apiKey
            }
        });

        const photos = (response.data.photos || []).map((photo) => ({
            id: photo.id.toString(),
            source: "pexels",
            previewUrl: photo.src.medium,
            fullUrl: photo.src.large,
            thumbUrl: photo.src.tiny,
            width: photo.width,
            height: photo.height,
            description: photo.alt || "Pexels Photo",
            author: {
                name: photo.photographer || "Photographer",
                username: photo.photographer_id,
                link: photo.photographer_url
            }
        }));

        res.status(200).json({
            success: true,
            total: response.data.total_results,
            page: Number(page),
            photos,
            results: photos
        });
    } catch (error) {
        console.error("[Pexels Error]:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            message: "Failed to search Pexels photos",
            error: error.response?.data?.message || error.message
        });
    }
};

/**
 * Upload local file to temporary Cloudinary storage
 * POST /api/media/upload
 */
export const uploadMedia = async (req, res) => {
    try {
        const file = req.file || (req.files && req.files.find((f) => f.fieldname === "file" || f.fieldname === "video" || f.fieldname === "image")) || (req.files && req.files[0]);
        if (!file) {
            return res.status(400).json({ success: false, message: "No file provided" });
        }

        const isVideo = (file.mimetype && file.mimetype.startsWith("video/")) || /\.(mp4|mov|webm|mkv|avi)$/i.test(file.originalname || "");
        const resourceType = isVideo ? "video" : "image";

        const uploaded = await uploadTemporaryMedia(file.buffer, {
            resourceType,
            filename: file.originalname
        });

        res.status(200).json({
            success: true,
            url: uploaded.secure_url,
            publicId: uploaded.public_id,
            resourceType: uploaded.resource_type,
            format: uploaded.format,
            bytes: uploaded.bytes,
            originalName: file.originalname
        });
    } catch (error) {
        console.error("[Media Upload Error]:", error);
        res.status(500).json({
            success: false,
            message: "Failed to upload media",
            error: process.env.NODE_ENV === "production" ? undefined : error.message
        });
    }
};

/**
 * Delete a temporary media item manually if needed
 * DELETE /api/media/temporary/:publicId
 */
export const cleanupTemporaryMedia = async (req, res) => {
    try {
        const { publicId } = req.params;
        const { resourceType = "image" } = req.query;

        const success = await deleteTemporaryMedia(publicId, resourceType);
        res.status(200).json({ success, message: "Temporary media cleaned up" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
