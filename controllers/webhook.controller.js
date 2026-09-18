import ScheduledPost from "../models/scheduledPost.model.js";
import PostHistory from "../models/postHistory.model.js";

// POST /api/webhooks/post-status
export const handlePostStatusWebhook = async (req, res) => {
    try {
        const secret = req.headers["x-webhook-secret"];
        if (!process.env.WEBHOOK_SECRET || secret !== process.env.WEBHOOK_SECRET) {
            console.warn("[Webhook] Unauthorized webhook secret attempt");
            return res.status(401).json({ success: false, message: "Unauthorized secret mismatch" });
        }

        const { postId, status, externalPostId, error } = req.body;

        if (!postId || !status) {
            return res.status(400).json({ success: false, message: "postId and status are required" });
        }

        const validStatuses = ["pending", "processing", "published", "failed", "cancelled"];
        let normalizedStatus = status.toLowerCase();
        if (status === "PUBLISHED") normalizedStatus = "published";
        if (status === "FAILED") normalizedStatus = "failed";
        if (status === "SCHEDULED") normalizedStatus = "pending";

        if (!validStatuses.includes(normalizedStatus)) {
            return res.status(400).json({ success: false, message: `Invalid status: ${status}` });
        }

        const post = await ScheduledPost.findByIdAndUpdate(
            postId,
            {
                $set: {
                    status: normalizedStatus,
                    externalPostId: externalPostId || undefined,
                    lastError: error || undefined,
                    publishedAt: normalizedStatus === "published" ? new Date() : undefined
                }
            },
            { new: true }
        );

        if (!post) {
            return res.status(404).json({ success: false, message: "Scheduled post not found" });
        }

        // If published, track in PostHistory for analytics
        if (normalizedStatus === "published") {
            const existingHistory = await PostHistory.findOne({
                postId: post._id.toString(),
                platform: post.platform,
                status: "PUBLISHED"
            });
            if (!existingHistory) {
                await PostHistory.create({
                    userId: post.userId,
                    postId: post._id.toString(),
                    platform: post.platform,
                    status: "PUBLISHED",
                    postedAt: new Date(),
                    externalPostId: externalPostId || undefined,
                    engagementMetrics: { views: 0, likes: 0, comments: 0, shares: 0 }
                });
            }
        }

        console.log(`[Webhook] Post status updated: ${postId} → ${normalizedStatus}`);
        res.status(200).json({ success: true, message: "Status updated successfully", post });
    } catch (err) {
        console.error("[Webhook Error]:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};
