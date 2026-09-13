import jwt from "jsonwebtoken";
import SocialAccount from "../../models/socialAccount.model.js";
import LinkedInPost from "../../models/linkedinPost.model.js";
import Post from "../../models/post.model.js";
import User from "../../models/user.model.js";

/**
 * Resolves the authenticated LinkedIn social account from the request.
 * Tries req.userId, Authorization header JWT, query token, or most recent LinkedIn account.
 */
export async function getLinkedInAccount(req) {
    let userId = req.userId?.toString();

    // Try Authorization header if req.userId not populated
    if (!userId && req.headers?.authorization) {
        try {
            const token = req.headers.authorization.split(" ")[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userId = decoded?.id || decoded?._id || decoded?.userId;
        } catch {
            // ignore token decode errors
        }
    }

    // Try query token
    if (!userId && req.query?.token) {
        try {
            const decoded = jwt.verify(req.query.token, process.env.JWT_SECRET);
            userId = decoded?.id || decoded?._id || decoded?.userId;
        } catch {
            // ignore
        }
    }

    let account = null;

    if (userId) {
        account = await SocialAccount.findOne({
            platform: "linkedin",
            $or: [{ userId }, { userId: userId.toString() }]
        });
    }

    // Fallback: match by temp-user-001 or most recent active LinkedIn account
    if (!account) {
        account = await SocialAccount.findOne({
            platform: "linkedin",
            $or: [{ userId: "temp-user-001" }, { platform: "linkedin" }]
        }).sort({ updatedAt: -1 });
    }

    if (!account) {
        return null;
    }

    // Auto-link to logged-in user if not already linked
    if (userId && account.userId !== userId) {
        await SocialAccount.updateOne({ _id: account._id }, { $set: { userId } });
        account.userId = userId;
    }

    const author = `urn:li:person:${account.platformUserId}`;
    return {
        account,
        userId: account.userId || userId || "temp-user-001",
        author,
        accessToken: account.accessToken,
        version: process.env.LINKEDIN_VERSION || "202601"
    };
}

/**
 * Records a successfully published post across both LinkedInPost and Post collections.
 */
export async function recordPublishedPost({
    userId,
    socialAccountId,
    platformPostId,
    commentary,
    postType = "text",
    mediaUrls = [],
    content = {}
}) {
    try {
        // 1. Save to LinkedInPost
        await LinkedInPost.create({
            userId: userId || "temp-user-001",
            socialAccountId,
            linkedinPostId: platformPostId,
            authorUrn: content?.author || "",
            commentary,
            lifecycleState: "PUBLISHED",
            visibility: "PUBLIC",
            publishedAt: new Date(),
            content,
            rawData: { postType, platformPostId }
        });

        // 2. Save to Post model for unified dashboard / queue display
        // If userId is a valid MongoDB ObjectId, use it; otherwise find or fallback
        let validUserObjectId = null;
        if (userId && userId.length === 24 && /^[0-9a-fA-F]{24}$/.test(userId)) {
            validUserObjectId = userId;
        } else {
            const anyUser = await User.findOne().sort({ createdAt: -1 }).select('_id').lean();
            if (anyUser) validUserObjectId = anyUser._id;
        }

        if (validUserObjectId) {
            await Post.create({
                userId: validUserObjectId,
                socialAccountId,
                platform: "linkedin",
                platforms: ["linkedin"],
                postType: postType.toUpperCase(),
                contentText: commentary,
                content: commentary,
                mediaUrls: mediaUrls.filter(Boolean),
                targetType: "FEED",
                visibility: "PUBLIC",
                status: "published",
                platformPostId,
                publishedAt: new Date()
            });
        }
    } catch (err) {
        console.error("Failed to record published post to DB:", err.message);
    }
}
