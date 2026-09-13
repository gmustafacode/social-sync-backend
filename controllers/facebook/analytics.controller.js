import axios from "axios";
import { getFacebookAccount, getFacebookPageToken } from "./helpers.js";

const GRAPH_API_VERSION = process.env.FACEBOOK_API_VERSION || "v25.0";
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// =====================================================
// PAGE ANALYTICS
// GET /api/social/facebook/analytics/:pageId
// =====================================================
export const getFacebookAnalytics = async (req, res) => {
    try {
        const { pageId: requestedPageId } = req.params;
        const { metric, period = "day", since, until } = req.query;

        const fbData = await getFacebookAccount(req);
        if (!fbData) {
            return res.status(404).json({
                success: false,
                message: "Facebook account not connected"
            });
        }

        let pageTokenInfo;
        try {
            pageTokenInfo = getFacebookPageToken(fbData, requestedPageId !== "default" ? requestedPageId : null);
        } catch (err) {
            return res.status(200).json({
                success: true,
                hasPages: false,
                message: err.message,
                data: []
            });
        }

        const { pageId, pageAccessToken, pageName } = pageTokenInfo;

        const params = {
            access_token: pageAccessToken,
            period
        };

        if (metric) {
            params.metric = metric;
        } else {
            params.metric = [
                "page_media_view",
                "page_views_total",
                "page_post_engagements",
                "page_follows",
                "page_video_views"
            ].join(",");
        }

        if (since) params.since = since;
        if (until) params.until = until;

        const response = await axios.get(
            `${GRAPH_URL}/${pageId}/insights`,
            { params }
        );

        return res.json({
            success: true,
            hasPages: true,
            pageId,
            pageName,
            data: response.data?.data || []
        });
    } catch (error) {
        console.error("Facebook Analytics Error:", error.response?.data || error.message);
        return res.status(error.response?.status || 500).json({
            success: false,
            message: "Failed to get Facebook analytics",
            facebookError: error.response?.data?.error?.message || error.response?.data,
            error: error.message
        });
    }
};