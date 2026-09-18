import {
    getInstagramAccount,
    instagramGraphPost,
    instagramGraphGet,
    getInstagramError
} from "../../config/instagram.js";

const waitForContainer = async (containerId, userId) => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
        const status = await instagramGraphGet(containerId, { fields: "id,status_code,status" }, userId);
        if (status.status_code === "FINISHED") return status;
        if (["ERROR", "EXPIRED"].includes(status.status_code)) throw new Error(`Instagram video container failed: ${status.status || status.status_code}`);
        if (attempt < 5) await new Promise((resolve) => setTimeout(resolve, 60 * 1000));
    }
    throw new Error("Instagram video container did not become FINISHED within 5 minutes");
};

export const createVideoPost = async (req, res) => {
    try {
        const { videoUrl, caption = "" } = req.body;
        if (!videoUrl) return res.status(400).json({ success: false, message: "videoUrl is required" });
        if (!/^https?:\/\//i.test(videoUrl)) return res.status(400).json({ success: false, message: "videoUrl must be a public HTTP/HTTPS URL" });
        const account = await getInstagramAccount(req.userId);
        const container = await instagramGraphPost(`${account.platformUserId}/media`, { media_type: "REELS", video_url: videoUrl, caption }, req.userId);
        if (!container.id) throw new Error("Instagram video container ID was not returned");
        await waitForContainer(container.id, req.userId);
        const published = await instagramGraphPost(`${account.platformUserId}/media_publish`, { creation_id: container.id }, req.userId);
        return res.json({ success: true, message: "Instagram video published successfully", containerId: container.id, mediaId: published.id });
    } catch (error) {
        console.error("Instagram video post error:", error?.response?.data || error);
        return res.status(error.statusCode || 500).json({ success: false, message: "Instagram video post failed", instagramError: getInstagramError(error), error: error.message });
    }
};
