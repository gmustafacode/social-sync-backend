import {
    getInstagramAccount,
    instagramGraphPost,
    instagramGraphGet,
    getInstagramError
} from "../../config/instagram.js";
import { buildPostMetadata, contentWithHashtags } from "../../utils/post-metadata.js";

const waitForImageContainer = async (containerId, userId) => {
    for (let attempt = 1; attempt <= 6; attempt += 1) {
        const status = await instagramGraphGet(containerId, { fields: "id,status_code,status" }, userId);
        if (status.status_code === "FINISHED") return status;
        if (["ERROR", "EXPIRED"].includes(status.status_code)) {
            throw new Error(`Instagram image container failed: ${status.status || status.status_code}`);
        }
        if (attempt < 6) await new Promise((resolve) => setTimeout(resolve, 10 * 1000));
    }
    throw new Error("Instagram image container did not become FINISHED within 1 minute");
};

export const createImagePost = async (req, res) => {
    try {
        const { imageUrl, caption = "" } = req.body;
        const metadata = buildPostMetadata({ content: caption, platform: "instagram", metadata: req.body.metadata });
        const finalCaption = contentWithHashtags(caption, metadata);
        if (!imageUrl) return res.status(400).json({ success: false, message: "imageUrl is required" });
        if (!/^https?:\/\//i.test(imageUrl)) return res.status(400).json({ success: false, message: "imageUrl must be a public HTTP/HTTPS URL" });
        const account = await getInstagramAccount(req.userId);
        const container = await instagramGraphPost(`${account.platformUserId}/media`, { image_url: imageUrl, caption: finalCaption }, req.userId);
        if (!container.id) throw new Error("Instagram image container ID was not returned");
        await waitForImageContainer(container.id, req.userId);
        const published = await instagramGraphPost(`${account.platformUserId}/media_publish`, { creation_id: container.id }, req.userId);
        return res.json({ success: true, message: "Instagram image published successfully", containerId: container.id, mediaId: published.id });
    } catch (error) {
        console.error("Instagram image post error:", error?.response?.data || error);
        return res.status(error.statusCode || 500).json({ success: false, message: "Instagram image post failed", instagramError: getInstagramError(error), error: error.message });
    }
};
