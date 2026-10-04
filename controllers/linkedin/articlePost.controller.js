import axios from "axios";
import { getLinkedInAccount, recordPublishedPost } from "./helpers.js";
import { buildPostMetadata, contentWithHashtags } from "../../utils/post-metadata.js";

/**
 * Creates a LinkedIn Article / Link post with link preview metadata.
 * POST /api/social/linkedin/post/article
 * Body: { text: string, url: string, title?: string, description?: string }
 */
export const createLinkedInArticlePost = async (req, res) => {
    try {
        const { text: rawText, url, link, source, title, description } = req.body;
        const metadata = buildPostMetadata({ content: rawText, platform: "linkedin", metadata: req.body.metadata });
        const text = contentWithHashtags(rawText, metadata);
        const targetUrl = url || link || source;

        if (!text || !text.trim()) {
            return res.status(400).json({ success: false, message: "Post text (commentary) is required" });
        }

        if (!targetUrl || !targetUrl.trim()) {
            return res.status(400).json({ success: false, message: "Article/Link URL is required" });
        }

        const linkedInData = await getLinkedInAccount(req);
        if (!linkedInData) {
            return res.status(404).json({ success: false, message: "LinkedIn account not connected" });
        }

        const { account, author, accessToken, version, userId } = linkedInData;

        const payload = {
            author,
            commentary: text.trim(),
            visibility: "PUBLIC",
            distribution: {
                feedDistribution: "MAIN_FEED",
                targetEntities: [],
                thirdPartyDistributionChannels: []
            },
            content: {
                article: {
                    source: targetUrl.trim(),
                    title: (title || targetUrl).trim(),
                    description: (description || "").trim()
                }
            },
            lifecycleState: "PUBLISHED"
        };

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

        const postId = response.headers["x-restli-id"] || response.data?.id;

        await recordPublishedPost({
            userId,
            socialAccountId: account._id,
            platformPostId: postId,
            commentary: text.trim(),
            postType: "article",
            mediaUrls: [targetUrl],
            content: payload,
            metadata
        });

        return res.status(201).json({
            success: true,
            message: "LinkedIn article/link post published successfully",
            postId,
            data: response.data
        });
    } catch (error) {
        console.error("LinkedIn Article Post Error:", error.response?.data || error.message);
        return res.status(error.response?.status || 500).json({
            success: false,
            message: "Failed to publish LinkedIn article post",
            error: error.response?.data || error.message
        });
    }
};
