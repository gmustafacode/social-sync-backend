import {
    getInstagramAccount,
    instagramGraphPost,
    instagramGraphGet,
    getInstagramError
} from "../../config/instagram.js";
import { buildPostMetadata, contentWithHashtags } from "../../utils/post-metadata.js";

const waitForReel = async (containerId, userId) => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
        const status = await instagramGraphGet(containerId, { fields: "id,status_code,status" }, userId);
        if (status.status_code === "FINISHED") return status;
        if (["ERROR", "EXPIRED"].includes(status.status_code)) throw new Error(status.status || status.status_code);
        if (attempt < 5) await new Promise((resolve) => setTimeout(resolve, 60 * 1000));
    }
    throw new Error("Reel container did not finish within 5 minutes");
};

export const createReelPost = async (req, res) => {
    try {
        const { videoUrl, caption = "", shareToFeed = true } = req.body;
        const metadata = buildPostMetadata({ content: caption, platform: "instagram", metadata: req.body.metadata });
        const finalCaption = contentWithHashtags(caption, metadata);
        if (!videoUrl) return res.status(400).json({ success: false, message: "videoUrl is required" });
        if (!/^https?:\/\//i.test(videoUrl)) return res.status(400).json({ success: false, message: "videoUrl must be a public HTTP/HTTPS URL" });
        const account = await getInstagramAccount(req.userId);
        const container = await instagramGraphPost(`${account.platformUserId}/media`, { media_type: "REELS", video_url: videoUrl, caption: finalCaption, share_to_feed: shareToFeed }, req.userId);
        if (!container.id) throw new Error("Instagram Reel container ID was not returned");
        await waitForReel(container.id, req.userId);
        const published = await instagramGraphPost(`${account.platformUserId}/media_publish`, { creation_id: container.id }, req.userId);
        return res.json({ success: true, message: "Instagram Reel published successfully", containerId: container.id, mediaId: published.id });
    } catch (error) {
        console.error("Instagram Reel error:", error?.response?.data || error);
        const instagramError = getInstagramError(error);
        const providerMessage = instagramError?.error?.message || instagramError?.message || error.message;
        return res.status(error.statusCode || error.response?.status || 500).json({
            success: false,
            message: `Instagram Reel publish failed: ${providerMessage}`,
            instagramError,
            error: error.message
        });
    }
};
