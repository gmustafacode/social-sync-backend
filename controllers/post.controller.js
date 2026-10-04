import axios from "axios";
import Post from "../models/post.model.js";
import ScheduledPost from "../models/scheduledPost.model.js";
import ContentQueue from "../models/contentQueue.model.js";
import SocialAccount from "../models/socialAccount.model.js";
import { getLinkedInAccount } from "./linkedin/helpers.js";
import { getFacebookAccount, getFacebookPageToken } from "./facebook/helpers.js";
import { publishPost } from "../services/posting.service.js";
import { publishLinkedInVideo } from "./linkedin/videoPost.controller.js";
import { buildPostMetadata, contentWithHashtags } from "../utils/post-metadata.js";

// ─── Helper: normalize a post doc into a clean frontend shape ─────────────
const normalizePost = (doc) => ({
    _id: doc._id,
    content: doc.contentText || doc.content || "",
    status: doc.status || "draft",
    platforms: doc.platforms || (doc.platform ? [doc.platform] : []),
    postType: (doc.postType || "text").toLowerCase(),
    mediaUrls: doc.mediaUrls || (doc.mediaUrl ? [doc.mediaUrl] : []),
    platformPostId: doc.platformPostId || doc.externalPostId,
    title: doc.title,
    linkUrl: doc.linkUrl,
    createdAt: doc.createdAt,
    scheduledFor: doc.scheduledAt || doc.scheduledFor,
    publishedAt: doc.publishedAt,
    lastError: doc.lastError,
    metadata: doc.metadata || {},
    hashtags: doc.hashtags || doc.metadata?.hashtags || [],
    keywords: doc.keywords || doc.metadata?.keywords || [],
    seoTitle: doc.seoTitle || doc.metadata?.seoTitle,
    seoDescription: doc.seoDescription || doc.metadata?.seoDescription,
    altText: doc.altText || doc.metadata?.altText,
});


// POST /api/posts
export const createPost = async (req, res) => {
    try {
        // Accept both old field names (contentText) and new (content)
        const {
            content,
            contentText,
            platforms = [],
            platform,
            socialAccountId,
            status = "queued",
            scheduledFor,
            scheduledAt,
            mediaUrl,
            postType,
            title,
            linkUrl,
            metadata = {},
            hashtags = [],
            keywords = [],
            seoTitle,
            seoDescription,
            altText,
            platformContent = {},
        } = req.body;

        const requestedText = content || contentText;
        const postMetadata = buildPostMetadata({
            content: requestedText,
            topic: title || "social media content",
            platform: (platforms[0] || platform || "linkedin").toLowerCase(),
            metadata: { ...metadata, hashtags, keywords, seoTitle, seoDescription, altText }
        });
        const text = contentWithHashtags(requestedText, postMetadata);
        if (!text) {
            return res.status(400).json({ success: false, message: "content is required" });
        }

        const resolvedPlatforms = platforms.length > 0 ? platforms : (platform ? [platform] : ["general"]);
        const resolvedScheduled = scheduledFor || scheduledAt;
        const isScheduled = !!resolvedScheduled && new Date(resolvedScheduled) > new Date();

        if (socialAccountId) {
            const ownedAccount = await SocialAccount.findOne({ _id: socialAccountId, userId: req.userId }).lean();
            if (!ownedAccount) {
                return res.status(403).json({ success: false, message: "Social account not found or unauthorized" });
            }
        }

        // If explicitly scheduled, create ScheduledPost entries per platform
        if (isScheduled || status === "scheduled") {
            const scheduledDocs = [];
            for (const plt of resolvedPlatforms) {
                // Auto-resolve social account if not provided
                let accountId = socialAccountId;
                if (!accountId && plt !== "general") {
                    const acc = await SocialAccount.findOne({
                        userId: req.userId,
                        platform: { $regex: new RegExp(`^${plt}$`, "i") },
                        isConnected: true
                    }).sort({ updatedAt: -1 }) || await SocialAccount.findOne({
                        userId: req.userId,
                        platform: { $regex: new RegExp(`^${plt}$`, "i") }
                    }).sort({ updatedAt: -1 });
                    if (acc) accountId = acc._id;
                }

                const doc = await ScheduledPost.create({
                    userId: req.userId,
                    socialAccountId: accountId,
                    platform: plt,
                    postType: (postType || "text").toUpperCase(),
                    title,
                    metadata: postMetadata,
                    platformContent,
                    hashtags: postMetadata.hashtags,
                    keywords: postMetadata.keywords,
                    seoTitle: postMetadata.seoTitle,
                    seoDescription: postMetadata.seoDescription,
                    altText: postMetadata.altText,
                    contentText: text,
                    mediaUrl,
                    scheduledAt: new Date(resolvedScheduled || Date.now()),
                    status: "pending",
                });
                scheduledDocs.push(doc);
            }

            // Also create or sync a Post record with status: "scheduled"
            const mainPost = await Post.create({
                userId: req.userId,
                socialAccountId: scheduledDocs[0]?.socialAccountId,
                platform: resolvedPlatforms[0] || "general",
                platforms: resolvedPlatforms,
                contentText: text,
                postType: (postType || "text").toUpperCase(),
                title,
                linkUrl,
                metadata: postMetadata,
                platformContent,
                hashtags: postMetadata.hashtags,
                keywords: postMetadata.keywords,
                seoTitle: postMetadata.seoTitle,
                seoDescription: postMetadata.seoDescription,
                altText: postMetadata.altText,
                mediaUrls: mediaUrl ? [mediaUrl] : [],
                status: "scheduled",
                scheduledAt: new Date(resolvedScheduled || Date.now()),
                scheduledFor: new Date(resolvedScheduled || Date.now()),
            });

            return res.status(201).json({
                success: true,
                post: normalizePost(mainPost),
                isScheduled: true,
            });
        }

        // Default: create a Post doc (queued/draft)
        const newPost = await Post.create({
            userId: req.userId,
            socialAccountId,
            platform: resolvedPlatforms[0] || "general",
            platforms: resolvedPlatforms,
            contentText: text,
            postType: (postType || "text").toUpperCase(),
            title,
            linkUrl,
            metadata: postMetadata,
            platformContent,
            hashtags: postMetadata.hashtags,
            keywords: postMetadata.keywords,
            seoTitle: postMetadata.seoTitle,
            seoDescription: postMetadata.seoDescription,
            altText: postMetadata.altText,
            mediaUrls: mediaUrl ? [mediaUrl] : [],
            status: status === "scheduled" ? "queued" : status,
        });

        res.status(201).json({ success: true, post: normalizePost(newPost) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/posts
export const getPosts = async (req, res) => {
    try {
        const { status, limit = 50 } = req.query;
        const query = { userId: req.userId };

        // Support filtering by comma-separated status values
        if (status) {
            const statuses = status.split(",").map((s) => s.trim());
            query.status = { $in: statuses };
        }

        const posts = await Post.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .lean();

        // Also pull scheduled posts and include them
        const scheduledPosts = await ScheduledPost.find({ userId: req.userId })
            .sort({ scheduledAt: -1 })
            .limit(50)
            .lean();

        const normalizedPosts = posts.map(normalizePost);
        const normalizedScheduled = scheduledPosts.map((p) => ({
            ...normalizePost(p),
            status: p.status === "published" ? "published" : "scheduled",
        }));

        // Combine into unified list avoiding duplicates by ID or identical content+timestamp
        const combinedPosts = [...normalizedPosts];
        const existingIds = new Set(combinedPosts.map((p) => p._id.toString()));
        for (const sp of normalizedScheduled) {
            if (!existingIds.has(sp._id.toString())) {
                // If filter is active, respect it
                if (!status || status.includes("scheduled") || (sp.status === "published" && status.includes("published"))) {
                    combinedPosts.push(sp);
                    existingIds.add(sp._id.toString());
                }
            }
        }

        res.status(200).json({
            success: true,
            posts: combinedPosts,
            scheduledPosts: normalizedScheduled,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/posts/scheduled
export const getScheduledPosts = async (req, res) => {
    try {
        const scheduledPosts = await ScheduledPost.find({ userId: req.userId })
            .sort({ scheduledAt: -1 })
            .lean();
        res.status(200).json({ success: true, scheduledPosts: scheduledPosts.map(normalizePost) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/posts/scheduled/:id/retry (also /api/posts/:id/retry)
export const retryScheduledPost = async (req, res) => {
    try {
        const post = await ScheduledPost.findOne({ _id: req.params.id, userId: req.userId });
        if (!post) return res.status(404).json({ success: false, message: "Scheduled post not found" });

        // Ensure socialAccountId is attached
        if (!post.socialAccountId) {
            const acc = await SocialAccount.findOne({
                userId: req.userId,
                platform: { $regex: new RegExp(`^${post.platform}$`, "i") },
                isConnected: true
            }).sort({ updatedAt: -1 }) || await SocialAccount.findOne({
                userId: req.userId,
                platform: { $regex: new RegExp(`^${post.platform}$`, "i") }
            }).sort({ updatedAt: -1 });
            if (acc) post.socialAccountId = acc._id;
        }

        post.status = "pending";
        post.scheduledAt = new Date();
        post.retryCount = 0;
        post.lastError = null;
        await post.save();

        res.status(200).json({ success: true, message: "Post queued for retry", post: normalizePost(post.toObject()) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// DELETE /api/posts/:id
export const deletePost = async (req, res) => {
    try {
        await Post.findOneAndDelete({ _id: req.params.id, userId: req.userId });
        await ScheduledPost.findOneAndDelete({ _id: req.params.id, userId: req.userId });
        res.status(200).json({ success: true, message: "Post deleted" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/posts/queue — return flat array
export const getContentQueue = async (req, res) => {
    try {
        const queueItems = await ContentQueue.find({ userId: req.userId }).sort({ createdAt: -1 }).lean();

        // Also include Post docs that are in 'queued' status
        const queuedPosts = await Post.find({ userId: req.userId, status: "queued" })
            .sort({ createdAt: -1 })
            .lean();

        const normalized = [
            ...queuedPosts.map(normalizePost),
            ...queueItems.map((item) => ({
                _id: item._id,
                content: item.rawContent || item.title || "",
                status: item.status || "pending",
                platforms: [],
                createdAt: item.createdAt,
                source: item.source,
                title: item.title,
            })),
        ];

        // Return as plain array
        res.status(200).json(normalized);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/posts/queue/:id/approve  (frontend sends PUT — accept both)
export const approveContentQueue = async (req, res) => {
    try {
        // Check ContentQueue first
        let item = await ContentQueue.findOne({ _id: req.params.id, userId: req.userId });
        if (item) {
            item.status = "approved";
            await item.save();
            return res.status(200).json({ success: true, message: "Content approved" });
        }

        // Fallback: check Post model
        const post = await Post.findOne({ _id: req.params.id, userId: req.userId });
        if (post) {
            post.status = "approved";
            await post.save();
            return res.status(200).json({ success: true, message: "Post approved" });
        }

        res.status(404).json({ success: false, message: "Item not found" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/posts/queue/:id/reject
export const rejectContentQueue = async (req, res) => {
    try {
        const { reason = "Rejected by user" } = req.body;

        let item = await ContentQueue.findOne({ _id: req.params.id, userId: req.userId });
        if (item) {
            item.status = "rejected";
            item.decisionReason = reason;
            await item.save();
            return res.status(200).json({ success: true, message: "Content rejected" });
        }

        const post = await Post.findOne({ _id: req.params.id, userId: req.userId });
        if (post) {
            post.status = "rejected";
            await post.save();
            return res.status(200).json({ success: true, message: "Post rejected" });
        }

        res.status(404).json({ success: false, message: "Item not found" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/posts/queue/fetch
export const fetchExternalContent = async (req, res) => {
    try {
        const { topic = "technology", source = "rss", items = [] } = req.body;
        const savedItems = [];

        if (items && items.length > 0) {
            for (const it of items) {
                const doc = await ContentQueue.create({
                    userId: req.userId,
                    source: it.source || source,
                    contentType: it.contentType || "text_only",
                    title: it.title || `Content from ${source}`,
                    rawContent: it.content || it.rawContent || it.summary,
                    summary: it.summary,
                    mediaUrl: it.mediaUrl,
                    status: "pending",
                });
                savedItems.push(doc);
            }
        } else {
            const doc = await ContentQueue.create({
                userId: req.userId,
                source,
                contentType: "text_only",
                title: `Discovery: ${topic}`,
                rawContent: `Latest developments and insights regarding ${topic} across industry channels.`,
                status: "pending",
            });
            savedItems.push(doc);
        }

        res.status(201).json({ success: true, count: savedItems.length, items: savedItems });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/posts/:id/publish — Instant publish for any post in queue/draft/scheduled
export const publishPostNow = async (req, res) => {
    try {
        let post = await Post.findOne({ _id: req.params.id, userId: req.userId });

        // Also check if it's in ContentQueue
        if (!post) {
            const queueItem = await ContentQueue.findOne({ _id: req.params.id, userId: req.userId });
            if (queueItem) {
                // Promote to post
                post = await Post.create({
                    userId: req.userId,
                    platform: "linkedin",
                    platforms: ["linkedin"],
                    contentText: queueItem.rawContent || queueItem.title,
                    status: "queued"
                });
                await ContentQueue.deleteOne({ _id: queueItem._id });
            }
        }

        // Also check if it's a ScheduledPost
        if (!post) {
            const scheduledDoc = await ScheduledPost.findOne({ _id: req.params.id, userId: req.userId });
            if (scheduledDoc) {
                const result = await publishPost(scheduledDoc);
                scheduledDoc.status = "published";
                scheduledDoc.publishedAt = new Date();
                scheduledDoc.externalPostId = result?.id || null;
                scheduledDoc.lastError = null;
                await scheduledDoc.save();

                return res.status(200).json({
                    success: true,
                    message: `Post published successfully to ${scheduledDoc.platform}`,
                    postId: result?.id,
                    post: normalizePost(scheduledDoc.toObject())
                });
            }
            return res.status(404).json({ success: false, message: "Post not found" });
        }

        const platforms = post.platforms || [post.platform || "linkedin"];
        const publishedPostIds = {};
        const successMessages = [];

        // 1. LinkedIn Publishing
        if (platforms.includes("linkedin") || post.platform === "linkedin") {
            try {
                const linkedInData = await getLinkedInAccount(req);
                if (linkedInData) {
                    const { author, accessToken, version, account } = linkedInData;
                    const text = post.contentText || post.content || "";

                    const postType = (post.postType || "TEXT").toUpperCase();
                    const mediaUrl = post.mediaUrls?.[0] || post.mediaUrl;
                    let linkedInId;

                    if (postType === "VIDEO" && mediaUrl) {
                        try {
                            const vidRes = await axios.get(mediaUrl, { responseType: "arraybuffer", timeout: 60000 });
                            const buffer = Buffer.from(vidRes.data);
                            const title = post.title || mediaUrl.split("/").pop()?.split("?")[0] || "Video";
                            const vidUpload = await publishLinkedInVideo({
                                author,
                                accessToken,
                                version,
                                commentary: text.trim(),
                                title,
                                buffer,
                                size: buffer.length
                            });
                            linkedInId = vidUpload.postId;
                        } catch (vidErr) {
                            console.error("LinkedIn video upload fallback in publishPostNow:", vidErr.message);
                        }
                    }

                    if (!linkedInId) {
                        const payload = {
                            author,
                            commentary: text.trim(),
                            visibility: "PUBLIC",
                            distribution: {
                                feedDistribution: "MAIN_FEED",
                                targetEntities: [],
                                thirdPartyDistributionChannels: []
                            },
                            lifecycleState: "PUBLISHED"
                        };

                        if (post.linkUrl || (postType === "VIDEO" && mediaUrl)) {
                            const sourceUrl = post.linkUrl || mediaUrl;
                            payload.content = {
                                article: {
                                    source: sourceUrl,
                                    title: post.title || "Video Content",
                                    description: post.description || text.trim() || ""
                                }
                            };
                        }

                        const response = await axios.post(
                            "https://api.linkedin.com/rest/posts",
                            payload,
                            {
                                headers: {
                                    Authorization: `Bearer ${accessToken}`,
                                    "Content-Type": "application/json",
                                    "X-Restli-Protocol-Version": "2.0.0",
                                    "LinkedIn-Version": version
                                }
                            }
                        );

                        linkedInId = response.headers["x-restli-id"] || response.data?.id;
                    }

                    publishedPostIds.linkedin = linkedInId;
                    post.platformPostId = linkedInId;
                    post.socialAccountId = account._id;
                    successMessages.push("LinkedIn");
                }
            } catch (liErr) {
                console.error("LinkedIn publish error in publishPostNow:", liErr.response?.data || liErr.message);
                throw new Error("LinkedIn publishing failed: " + (liErr.response?.data?.message || liErr.message));
            }
        }

        // 2. Facebook Publishing
        if (platforms.includes("facebook") || post.platform === "facebook") {
            try {
                const fbData = await getFacebookAccount(req);
                if (fbData) {
                    const { pageId, pageAccessToken, pageName } = getFacebookPageToken(fbData, post.targetId);
                    const graphUrl = `https://graph.facebook.com/${process.env.FACEBOOK_API_VERSION || "v25.0"}`;
                    const text = post.contentText || post.content || "";
                    const mediaUrl = post.mediaUrls?.[0] || post.mediaUrl;
                    const postType = (post.postType || "TEXT").toUpperCase();

                    let fbResponse;
                    if (postType === "VIDEO" && mediaUrl) {
                        fbResponse = await axios.post(`${graphUrl}/${pageId}/videos`, null, {
                            params: {
                                file_url: mediaUrl,
                                description: text,
                                access_token: pageAccessToken
                            }
                        });
                    } else if (mediaUrl) {
                        fbResponse = await axios.post(`${graphUrl}/${pageId}/photos`, null, {
                            params: {
                                url: mediaUrl,
                                caption: text,
                                access_token: pageAccessToken
                            }
                        });
                    } else if (post.linkUrl) {
                        fbResponse = await axios.post(`${graphUrl}/${pageId}/feed`, null, {
                            params: {
                                message: text,
                                link: post.linkUrl,
                                access_token: pageAccessToken
                            }
                        });
                    } else {
                        fbResponse = await axios.post(`${graphUrl}/${pageId}/feed`, null, {
                            params: {
                                message: text,
                                access_token: pageAccessToken
                            }
                        });
                    }

                    const fbId = fbResponse.data?.post_id || fbResponse.data?.id;
                    publishedPostIds.facebook = fbId;
                    if (!post.platformPostId) post.platformPostId = fbId;
                    successMessages.push(`Facebook (${pageName})`);
                }
            } catch (fbErr) {
                console.error("Facebook publish error in publishPostNow:", fbErr.response?.data || fbErr.message);
                throw new Error("Facebook publishing failed: " + (fbErr.response?.data?.error?.message || fbErr.message));
            }
        }

        post.status = "published";
        post.publishedAt = new Date();
        await post.save();

        return res.status(200).json({
            success: true,
            message: `Post published successfully to ${successMessages.join(" and ") || "platforms"}`,
            postIds: publishedPostIds,
            postId: post.platformPostId,
            post: normalizePost(post.toObject())
        });
    } catch (error) {
        console.error("publishPostNow error:", error.response?.data || error.message);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

