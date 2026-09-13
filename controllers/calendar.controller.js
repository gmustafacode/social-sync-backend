import ScheduledPost from "../models/scheduledPost.model.js";
import Post from "../models/post.model.js";
import LinkedInPost from "../models/linkedinPost.model.js";

// GET /api/calendar
export const getCalendarEvents = async (req, res) => {
    try {
        const userId = req.userId;

        // Fetch Scheduled Posts
        const scheduledPosts = await ScheduledPost.find({ userId }).lean();

        // Fetch Regular Posts
        const regularPosts = await Post.find({ userId }).lean();

        // Fetch LinkedIn Posts
        const linkedInPosts = await LinkedInPost.find({ userId }).lean();

        const events = [];

        scheduledPosts.forEach(p => {
            const date = p.scheduledAt || p.publishedAt || p.createdAt;
            if (date) {
                events.push({
                    id: `scheduled-${p._id}`,
                    _id: p._id.toString(),
                    title: (p.contentText || p.content || "").substring(0, 50) + "...",
                    date: new Date(date).toISOString(),
                    platform: p.platform || "general",
                    platforms: p.platforms || (p.platform ? [p.platform] : []),
                    status: p.status || "scheduled",
                    type: "scheduled"
                });
            }
        });

        regularPosts.forEach(p => {
            const date = p.scheduledAt || p.createdAt;
            if (date) {
                events.push({
                    id: `post-${p._id}`,
                    _id: p._id.toString(),
                    title: (p.contentText || p.content || "").substring(0, 50) + "...",
                    date: new Date(date).toISOString(),
                    platform: p.platform || "general",
                    platforms: p.platforms || (p.platform ? [p.platform] : []),
                    status: p.status || "draft",
                    type: "standard"
                });
            }
        });

        linkedInPosts.forEach(p => {
            const date = p.scheduledAt || p.createdAt;
            if (date) {
                events.push({
                    id: `li-${p._id}`,
                    _id: p._id.toString(),
                    title: (p.description || p.contentText || "").substring(0, 50) + "...",
                    date: new Date(date).toISOString(),
                    platform: "linkedin",
                    platforms: ["linkedin"],
                    status: p.status ? p.status.toLowerCase() : "published",
                    type: "linkedin"
                });
            }
        });

        res.status(200).json({ success: true, events });
    } catch (error) {
        console.error("[Calendar Error]:", error);
        res.status(500).json({ success: false, message: "Failed to fetch calendar events", error: error.message });
    }
};
