import SocialAccount from "../../models/socialAccount.model.js";
import Post from "../../models/post.model.js";
import User from "../../models/user.model.js";

/**
 * Resolves the authenticated Facebook social account from the request.
 * Tries req.userId, Authorization header JWT, query token, or most recent Facebook account.
 */
export async function getFacebookAccount(req) {
    let userId = req.userId?.toString();

    if (!userId) return null;
    const account = await SocialAccount.findOne({ platform: "facebook", userId });

    if (!account) {
        return null;
    }

    const pages = account.metadata?.pages || [];
    const defaultPage = pages.length > 0 ? pages[0] : null;

    return {
        account,
        userId,
        pages,
        defaultPage,
        accessToken: account.accessToken
    };
}

/**
 * Extracts the Facebook Page ID and Page Access Token.
 * If pageId is provided, finds that page; otherwise falls back to the default page.
 */
export function getFacebookPageToken(accountData, requestedPageId) {
    const pages = accountData.pages || [];

    if (pages.length === 0) {
        throw new Error(
            "No Facebook Page found for this account. Meta Graph API v25.0 requires a Facebook Page to publish content. Please create a Facebook Page at https://www.facebook.com/pages/create/ and click 'Sync Facebook Pages' in Connected Accounts."
        );
    }

    let page = null;
    if (requestedPageId) {
        page = pages.find((p) => p.id === requestedPageId);
    }

    if (!page) {
        page = pages[0]; // fallback to first connected page
    }

    if (!page?.access_token) {
        throw new Error(`Page Access Token missing for Facebook Page: "${page?.name || requestedPageId}"`);
    }

    return {
        pageId: page.id,
        pageAccessToken: page.access_token,
        pageName: page.name
    };
}

/**
 * Records a successfully published Facebook post across Post collection.
 */
export async function recordFacebookPost({
    userId,
    socialAccountId,
    platformPostId,
    postType = "text",
    message,
    mediaUrls = [],
    pageId
}) {
    try {
        if (userId) {
            await Post.create({
                userId,
                socialAccountId,
                platform: "facebook",
                platforms: ["facebook"],
                postType: postType.toUpperCase(),
                contentText: message || "",
                content: message || "",
                mediaUrls: mediaUrls.filter(Boolean),
                targetType: "PAGE",
                targetId: pageId,
                visibility: "PUBLIC",
                status: "published",
                platformPostId,
                publishedAt: new Date()
            });
        }
    } catch (err) {
        console.error("[Facebook DB Record Error]:", err.message);
    }
}

export default {
    getFacebookAccount,
    getFacebookPageToken,
    recordFacebookPost
};
