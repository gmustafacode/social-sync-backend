import axios from "axios";
import {
    getFacebookAccount,
    getFacebookPageToken,
    recordFacebookPost
} from "./helpers.js";

const GRAPH_API_VERSION = process.env.FACEBOOK_API_VERSION || "v25.0";
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// =====================================================
// CREATE TEXT OR LINK POST
// POST /api/social/facebook/post/text
// =====================================================
export const createTextPost = async (req, res) => {
    try {
        const {
            pageId: requestedPageId,
            message,
            text,
            link,
            url,
            published,
            scheduledPublishTime
        } = req.body;

        const postMessage = message || text;
        const postLink = link || url;

        if (!postMessage && !postLink) {
            return res.status(400).json({
                success: false,
                message: "message or link is required"
            });
        }

        const fbData = await getFacebookAccount(req);
        if (!fbData) {
            return res.status(404).json({
                success: false,
                message: "Facebook account not connected"
            });
        }

        const { pageId, pageAccessToken, pageName } = getFacebookPageToken(fbData, requestedPageId);

        const params = {
            access_token: pageAccessToken
        };

        if (postMessage) {
            params.message = postMessage;
        }

        if (postLink) {
            params.link = postLink;
        }

        if (published !== undefined) {
            params.published = published;
        }

        if (scheduledPublishTime) {
            params.scheduled_publish_time = scheduledPublishTime;
            params.published = false;
        }

        const response = await axios.post(
            `${GRAPH_URL}/${pageId}/feed`,
            null,
            { params }
        );

        const platformPostId = response.data?.id;

        // Record post in Post collection
        await recordFacebookPost({
            userId: fbData.userId,
            socialAccountId: fbData.account._id,
            platformPostId,
            postType: postLink ? "article" : "text",
            message: postMessage || postLink,
            mediaUrls: postLink ? [postLink] : [],
            pageId
        });

        return res.json({
            success: true,
            message: `Facebook post published to "${pageName}"`,
            postId: platformPostId,
            pageId,
            pageName,
            data: response.data
        });
    } catch (error) {
        console.error("Facebook Text Post Error:", error.response?.data || error.message);
        const fbErrMsg = error.response?.data?.error?.message;

        return res.status(error.response?.status || 500).json({
            success: false,
            message: fbErrMsg || error.message || "Facebook text post failed",
            facebookError: error.response?.data?.error || error.response?.data,
            error: error.message
        });
    }
};

// =====================================================
// GET PAGE POSTS
// GET /api/social/facebook/posts/:pageId
// =====================================================
export const getPagePosts = async (req, res) => {
    try {
        const { pageId: requestedPageId } = req.params;
        const { limit = 25, after } = req.query;

        const fbData = await getFacebookAccount(req);
        if (!fbData) {
            return res.status(404).json({
                success: false,
                message: "Facebook account not connected"
            });
        }

        const { pageId, pageAccessToken } = getFacebookPageToken(fbData, requestedPageId);

        const params = {
            access_token: pageAccessToken,
            fields: [
                "id",
                "message",
                "created_time",
                "updated_time",
                "permalink_url",
                "attachments",
                "comments.summary(true)",
                "reactions.summary(true)"
            ].join(","),
            limit
        };

        if (after) {
            params.after = after;
        }

        const response = await axios.get(
            `${GRAPH_URL}/${pageId}/posts`,
            { params }
        );

        return res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        return res.status(error.response?.status || 500).json({
            success: false,
            message: "Failed to get Facebook posts",
            facebookError: error.response?.data?.error?.message || error.response?.data,
            error: error.message
        });
    }
};

// =====================================================
// GET SINGLE POST
// GET /api/social/facebook/post/:postId
// =====================================================
export const getSinglePost = async (req, res) => {
    try {
        const { postId } = req.params;
        const fbData = await getFacebookAccount(req);

        if (!fbData) {
            return res.status(404).json({
                success: false,
                message: "Facebook account not connected"
            });
        }

        const pages = fbData.pages || [];
        let pageToken = pages[0]?.access_token || fbData.accessToken;

        const response = await axios.get(
            `${GRAPH_URL}/${postId}`,
            {
                params: {
                    fields: [
                        "id",
                        "message",
                        "created_time",
                        "updated_time",
                        "permalink_url",
                        "attachments",
                        "comments.summary(true)",
                        "reactions.summary(true)"
                    ].join(","),
                    access_token: pageToken
                }
            }
        );

        return res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        return res.status(error.response?.status || 500).json({
            success: false,
            message: "Failed to get Facebook post",
            facebookError: error.response?.data?.error?.message || error.response?.data,
            error: error.message
        });
    }
};