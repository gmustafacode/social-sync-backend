import User from "../models/user.model.js";
import Post from "../models/post.model.js";
import PostHistory from "../models/postHistory.model.js";
import AILog from "../models/aiLog.model.js";

const OPS_LIMITS = {
    LINKEDIN: { DAILY_POSTS: 25, MIN_INTERVAL_MINUTES: 15 },
    X: { DAILY_POSTS: 25, MIN_INTERVAL_MINUTES: 5 },
    FACEBOOK: { DAILY_POSTS: 25, MIN_INTERVAL_MINUTES: 10 },
    INSTAGRAM: { DAILY_POSTS: 25, MIN_INTERVAL_MINUTES: 15 }
};

// GET /api/user/limits?platform=linkedin
export const getUserLimits = async (req, res) => {
    try {
        const userId = req.userId;
        const platform = (req.query.platform || "linkedin").toLowerCase();
        const platformKey = platform.toUpperCase();

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        // Daily post count from PostHistory and Post
        const historyCount = await PostHistory.countDocuments({
            userId,
            platform,
            postedAt: { $gte: todayStart, $lte: todayEnd },
            status: "PUBLISHED"
        });

        const todayPosts = await Post.countDocuments({
            userId,
            createdAt: { $gte: todayStart, $lte: todayEnd }
        });

        // AI Calls count today
        const todayAiCalls = await AILog.countDocuments({
            userId: userId.toString(),
            createdAt: { $gte: todayStart, $lte: todayEnd }
        });

        const dailyCount = Math.max(historyCount, todayPosts);
        const limit = OPS_LIMITS[platformKey]?.DAILY_POSTS || 25;
        const minInterval = OPS_LIMITS[platformKey]?.MIN_INTERVAL_MINUTES || 10;

        const lastPost = await PostHistory.findOne({
            userId,
            platform
        }).sort({ postedAt: -1 }).lean();

        let nextPostAvailableAt = now;
        let isRateLimited = false;

        if (lastPost && lastPost.postedAt) {
            const postedDate = new Date(lastPost.postedAt);
            const nextAllowed = new Date(postedDate.getTime() + minInterval * 60000);
            if (now < nextAllowed) {
                isRateLimited = true;
                nextPostAvailableAt = nextAllowed;
            }
        }

        res.status(200).json({
            success: true,
            postsToday: dailyCount,
            postsLimit: limit,
            aiCallsToday: todayAiCalls,
            aiCallsLimit: 50,
            limits: {
                platform,
                used: dailyCount,
                limit,
                percentage: Math.min(100, Math.round((dailyCount / limit) * 100)),
                isRateLimited,
                nextPostAvailableAt: nextPostAvailableAt.toISOString(),
                exhausted: dailyCount >= limit
            }
        });
    } catch (error) {
        console.error("[User Limits Error]:", error);
        res.status(500).json({ success: false, message: "Failed to fetch limits", error: error.message });
    }
};

// GET /api/user/profile
export const getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select("-password").lean();
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        res.status(200).json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
