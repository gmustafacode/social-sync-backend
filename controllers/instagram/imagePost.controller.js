import {
    getInstagramAccount,
    instagramGraphPost,
    getInstagramError
} from "../../config/instagram.js";

export const createImagePost = async (req, res) => {
    try {
        const { imageUrl, caption = "" } = req.body;
        if (!imageUrl) return res.status(400).json({ success: false, message: "imageUrl is required" });
        if (!/^https?:\/\//i.test(imageUrl)) return res.status(400).json({ success: false, message: "imageUrl must be a public HTTP/HTTPS URL" });
        const account = await getInstagramAccount(req.userId);
        const container = await instagramGraphPost(`${account.platformUserId}/media`, { image_url: imageUrl, caption }, req.userId);
        if (!container.id) throw new Error("Instagram image container ID was not returned");
        const published = await instagramGraphPost(`${account.platformUserId}/media_publish`, { creation_id: container.id }, req.userId);
        return res.json({ success: true, message: "Instagram image published successfully", containerId: container.id, mediaId: published.id });
    } catch (error) {
        console.error("Instagram image post error:", error?.response?.data || error);
        return res.status(error.statusCode || 500).json({ success: false, message: "Instagram image post failed", instagramError: getInstagramError(error), error: error.message });
    }
};
