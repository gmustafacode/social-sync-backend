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

    if (!userId) return null;
    const account = await SocialAccount.findOne({ platform: "linkedin", userId });

    if (!account) {
        return null;
    }

    const author = `urn:li:person:${account.platformUserId}`;
    return {
        account,
        userId,
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
            userId,
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
        if (userId) {
            await Post.create({
                userId,
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
