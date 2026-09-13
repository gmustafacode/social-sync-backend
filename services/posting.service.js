import { decrypt } from "../utils/encryption.js";
import axios from "axios";
import SocialAccount from "../models/socialAccount.model.js";
import { publishLinkedInVideo } from "../controllers/linkedin/videoPost.controller.js";

/**
 * Main function to route publishing logic based on platform
 */
export const publishPost = async (post) => {
    let account = post.socialAccountId;
    const platform = (post.platform || account?.platform || "linkedin").toLowerCase();

    // If account is missing, unpopulated, or an ID string
    if (!account || typeof account === "string" || (!account.accessToken && !account.encryptedAccessToken && !account.metadata?.pages)) {
        const accountId = account?._id || (typeof account === "string" ? account : null);
        if (accountId) {
            account = await SocialAccount.findById(accountId);
        }

        if (!account && post.userId) {
            const uid = post.userId.toString();
            // Find active connected account for this user & platform
            account = await SocialAccount.findOne({
                userId: { $in: [uid, post.userId] },
                platform: { $regex: new RegExp(`^${platform}$`, "i") },
                isConnected: true
            }).sort({ updatedAt: -1 });

            // Fallback: check any account for this platform
            if (!account) {
                account = await SocialAccount.findOne({
                    userId: { $in: [uid, post.userId] },
                    platform: { $regex: new RegExp(`^${platform}$`, "i") }
                }).sort({ updatedAt: -1 });
            }
        }
    }

    if (!account) {
        throw new Error(`No connected ${platform} social account found for this user.`);
    }

    // Attach resolved account back to post object
    post.socialAccountId = account;

    // Retrieve decrypted access token
    let accessToken;
    if (account.encryptedAccessToken) {
        accessToken = decrypt(account.encryptedAccessToken);
    } else if (account.accessToken) {
        accessToken = account.accessToken;
    }

    if (!accessToken && platform.toLowerCase() !== "facebook") {
        throw new Error(`Missing access token for ${platform}`);
    }

    switch (platform.toLowerCase()) {
        case "linkedin":
            return publishToLinkedIn(account, post, accessToken);
        case "facebook":
            return publishToFacebook(account, post, accessToken);
        case "x":
            return publishToX(account, post, accessToken);
        case "instagram":
            return publishToInstagram(account, post, accessToken);
        default:
            throw new Error(`Platform ${platform} not supported for automated publishing yet.`);
    }
};

const publishToLinkedIn = async (account, post, accessToken) => {
    const personUrn = `urn:li:person:${account.platformUserId}`;
    const version = process.env.LINKEDIN_VERSION || "202601";
    const mediaUrl = post.mediaUrl || (post.mediaUrls && post.mediaUrls[0]);
    const postType = (post.postType || "TEXT").toUpperCase();

    // Direct Native LinkedIn Video Post
    if (postType === "VIDEO" && mediaUrl) {
        try {
            const vidRes = await axios.get(mediaUrl, { responseType: "arraybuffer", timeout: 60000 });
            const buffer = Buffer.from(vidRes.data);
            const title = post.title || mediaUrl.split("/").pop()?.split("?")[0] || "Video";
            const videoResult = await publishLinkedInVideo({
                author: personUrn,
                accessToken,
                version,
                commentary: post.contentText || post.content || "",
                title,
                buffer,
                size: buffer.length
            });
            return { id: videoResult.postId };
        } catch (vidErr) {
            console.error("[LinkedIn Video Publish Fallback]:", vidErr.message);
        }
    }

    const payload = {
        author: personUrn,
        commentary: post.contentText || post.content || "",
        visibility: "PUBLIC",
        distribution: {
            feedDistribution: "MAIN_FEED",
            targetEntities: [],
            thirdPartyDistributionChannels: []
        },
        lifecycleState: "PUBLISHED"
    };

    // If article / link source provided (or video fallback)
    if (post.linkUrl || post.articleUrl || (postType === "VIDEO" && mediaUrl)) {
        const sourceUrl = post.linkUrl || post.articleUrl || mediaUrl;
        payload.content = {
            article: {
                source: sourceUrl,
                title: post.title || post.linkTitle || "Video Content",
                description: post.description || post.linkDescription || post.contentText || ""
            }
        };
    }

    const response = await axios.post("https://api.linkedin.com/rest/posts", payload, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "LinkedIn-Version": version,
            "X-Restli-Protocol-Version": "2.0.0",
            "Content-Type": "application/json"
        }
    });

    const postId = response.headers["x-restli-id"] || response.data?.id;
    return { id: postId };
};

const publishToFacebook = async (account, post, accessToken) => {
    const apiVersion = process.env.FACEBOOK_API_VERSION || "v25.0";
    const graphUrl = `https://graph.facebook.com/${apiVersion}`;

    // Meta Graph API requires Page Access Token to publish to Pages
    const pages = account.metadata?.pages || [];
    if (pages.length === 0) {
        throw new Error(
            "No Facebook Page connected for this account. In Meta Graph API v25.0, posting requires a Facebook Page. Create a Facebook Page at https://www.facebook.com/pages/create/ and click 'Sync Facebook Pages' in Connected Accounts."
        );
    }

    // Default to first page or target page if specified
    const targetPageId = post.targetId;
    const page = targetPageId ? pages.find((p) => p.id === targetPageId) || pages[0] : pages[0];

    if (!page?.access_token) {
        throw new Error(`Page access token missing for Facebook Page: "${page?.name || page?.id}"`);
    }

    const pageAccessToken = page.access_token;
    const pageId = page.id;
    const message = post.contentText || post.content || "";
    const mediaUrl = post.mediaUrl || (post.mediaUrls && post.mediaUrls[0]);
    const postType = (post.postType || "TEXT").toUpperCase();

    // 1. Image Post
    if (postType === "IMAGE" && mediaUrl) {
        const response = await axios.post(`${graphUrl}/${pageId}/photos`, null, {
            params: {
                url: mediaUrl,
                caption: message,
                access_token: pageAccessToken
            }
        });
        return { id: response.data?.post_id || response.data?.id };
    }

    // 2. Video Post
    if (postType === "VIDEO" && mediaUrl) {
        const response = await axios.post(`${graphUrl}/${pageId}/videos`, null, {
            params: {
                file_url: mediaUrl,
                description: message,
                access_token: pageAccessToken
            }
        });
        return { id: response.data?.id };
    }

    // 3. Link Post
    if (post.linkUrl || post.articleUrl) {
        const link = post.linkUrl || post.articleUrl;
        const response = await axios.post(`${graphUrl}/${pageId}/feed`, null, {
            params: {
                message,
                link,
                access_token: pageAccessToken
            }
        });
        return { id: response.data?.id };
    }

    // 4. Default Text Post
    const response = await axios.post(`${graphUrl}/${pageId}/feed`, null, {
        params: {
            message,
            access_token: pageAccessToken
        }
    });

    return { id: response.data?.id };
};

const publishToX = async (account, post, accessToken) => {
    const url = "https://api.twitter.com/2/tweets";

    const response = await axios.post(
        url,
        { text: post.contentText },
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            }
        }
    );

    return { id: response.data.data.id };
};

const publishToInstagram = async (account, post, accessToken) => {
    const apiVersion = process.env.INSTAGRAM_API_VERSION || "v25.0";
    const graphUrl = `https://graph.facebook.com/${apiVersion}`;

    const mediaUrl = post.mediaUrl || (post.mediaUrls && post.mediaUrls[0]);
    if (!mediaUrl) throw new Error("Instagram requires a media URL (image or video) to publish.");

    const containerRes = await axios.post(`${graphUrl}/${account.platformUserId}/media`, null, {
        params: {
            image_url: mediaUrl,
            caption: post.contentText,
            access_token: accessToken
        }
    });

    const containerId = containerRes.data?.id;
    if (!containerId) throw new Error("Instagram container ID not received.");

    const publishRes = await axios.post(`${graphUrl}/${account.platformUserId}/media_publish`, null, {
        params: {
            creation_id: containerId,
            access_token: accessToken
        }
    });

    return { id: publishRes.data?.id };
};
