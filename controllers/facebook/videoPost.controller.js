import axios from "axios";
import {
    getFacebookAccount,
    getFacebookPageToken,
    recordFacebookPost
} from "./helpers.js";
import {
    uploadTemporaryMedia,
    deleteTemporaryMedia
} from "../../services/cloudinary.service.js";
import { buildPostMetadata, contentWithHashtags } from "../../utils/post-metadata.js";

const GRAPH_API_VERSION = process.env.FACEBOOK_API_VERSION || "v25.0";
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export const createVideoPost = async (req, res) => {
    let temporaryCloudinaryId = null;

    try {
        const {
            pageId: requestedPageId,
            title,
            description,
            text,
            videoUrl
        } = req.body;

        const metadata = buildPostMetadata({ content: description || text || title || "", platform: "facebook", metadata: req.body.metadata });
        const postDesc = contentWithHashtags(description || text || title || "", metadata);

        const file = req.file || (req.files && req.files.find((f) => f.fieldname === "video" || f.fieldname === "file")) || (req.files && req.files[0]);

        if (!file && !videoUrl) {
            return res.status(400).json({
                success: false,
                message: "Upload a video file or provide videoUrl"
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

        let finalVideoUrl = videoUrl;

        // If local file uploaded, upload to Cloudinary temporary storage first
        if (file) {
            const uploaded = await uploadTemporaryMedia(file.buffer, {
                resourceType: "video",
                filename: file.originalname
            });
            finalVideoUrl = uploaded.secure_url;
            temporaryCloudinaryId = uploaded.public_id;
        }

        // Post to Facebook Page /videos
        const params = {
            file_url: finalVideoUrl,
            description: postDesc,
            access_token: pageAccessToken
        };

        if (title) {
            params.title = title;
        }

        const response = await axios.post(
            `${GRAPH_URL}/${pageId}/videos`,
            null,
            { params }
        );

        const platformPostId = response.data?.id;

        // Record post in DB
        await recordFacebookPost({
            userId: fbData.userId,
            socialAccountId: fbData.account._id,
            platformPostId,
            postType: "video",
            message: postDesc,
            mediaUrls: finalVideoUrl ? [finalVideoUrl] : [],
            pageId
        });

        return res.json({
            success: true,
            message: `Facebook video published to "${pageName}"`,
            postId: platformPostId,
            pageId,
            pageName,
            data: response.data
        });
    } catch (error) {
        console.error("Facebook Video Error:", error.response?.data || error.message);
        const fbErrMsg = error.response?.data?.error?.message;

        return res.status(error.response?.status || 500).json({
            success: false,
            message: fbErrMsg || error.message || "Facebook video post failed",
            facebookError: error.response?.data?.error || error.response?.data,
            error: error.message
        });
    } finally {
        // Enforce Cloudinary temporary lifecycle: delete asset immediately after posting
        if (temporaryCloudinaryId) {
            deleteTemporaryMedia(temporaryCloudinaryId, "video").catch((err) => {
                console.warn("[Cloudinary Video Cleanup Error]:", err.message);
            });
        }
    }
};