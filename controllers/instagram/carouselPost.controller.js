import {
    getInstagramAccount,
    instagramGraphPost,
    instagramGraphGet,
    getInstagramError
} from "../../config/instagram.js";

const waitForVideoChild = async (containerId, userId) => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
        const status = await instagramGraphGet(containerId, { fields: "id,status_code,status" }, userId);
        if (status.status_code === "FINISHED") return status;
        if (["ERROR", "EXPIRED"].includes(status.status_code)) throw new Error(status.status || status.status_code);
        if (attempt < 5) await new Promise((resolve) => setTimeout(resolve, 60 * 1000));
    }
    throw new Error("Carousel video child did not finish");
};

export const createCarouselPost = async (req, res) => {
    try {
        const { items, caption = "" } = req.body;
        if (!Array.isArray(items) || items.length < 2 || items.length > 10) return res.status(400).json({ success: false, message: "Carousel must contain 2 to 10 items" });
        const account = await getInstagramAccount(req.userId);
        const childContainerIds = [];
        for (const item of items) {
            if (!item?.url || !item?.type) throw new Error("Every carousel item needs type and url");
            const type = String(item.type).toUpperCase();
            const body = type === "IMAGE" ? { image_url: item.url, is_carousel_item: true } : type === "VIDEO" ? { media_type: "REELS", video_url: item.url, is_carousel_item: true } : null;
            if (!body) throw new Error("Carousel item type must be IMAGE or VIDEO");
            const container = await instagramGraphPost(`${account.platformUserId}/media`, body, req.userId);
            if (!container.id) throw new Error("Instagram carousel child container ID missing");
            if (type === "VIDEO") await waitForVideoChild(container.id, req.userId);
            childContainerIds.push(container.id);
        }
        const carousel = await instagramGraphPost(`${account.platformUserId}/media`, { media_type: "CAROUSEL", children: childContainerIds.join(","), caption }, req.userId);
        if (!carousel.id) throw new Error("Instagram carousel container ID missing");
        const published = await instagramGraphPost(`${account.platformUserId}/media_publish`, { creation_id: carousel.id }, req.userId);
        return res.json({ success: true, message: "Instagram carousel published successfully", childContainerIds, carouselContainerId: carousel.id, mediaId: published.id });
    } catch (error) {
        console.error("Instagram carousel error:", error?.response?.data || error);
        return res.status(error.statusCode || 500).json({ success: false, message: "Instagram carousel publish failed", instagramError: getInstagramError(error), error: error.message });
    }
};
