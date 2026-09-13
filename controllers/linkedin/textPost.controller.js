import axios from "axios";
import { getLinkedInAccount, recordPublishedPost } from "./helpers.js";

// ========================================
// Create LinkedIn Text Post
// POST /api/social/linkedin/post/text
// Body: { text: string } (or { content: string })
// ========================================

export const createLinkedInTextPost = async (req, res) => {
    try {
        const text = req.body.text || req.body.content || req.body.commentary;

        if (!text || !text.trim()) {
            return res.status(400).json({
                success: false,
                message: "Post text is required"
            });
        }

        const linkedInData = await getLinkedInAccount(req);
        if (!linkedInData) {
            return res.status(404).json({
                success: false,
                message: "LinkedIn account not connected"
            });
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
            postType: "text",
            content: payload
        });

        return res.status(201).json({
            success: true,
            message: "LinkedIn text post published successfully",
            postId,
            data: response.data
        });
    } catch (error) {
        console.error("LinkedIn Text Post Error:", error.response?.data || error.message);
        return res.status(error.response?.status || 500).json({
            success: false,
            message: "Failed to publish LinkedIn text post",
            error: error.response?.data || error.message
        });
    }
};