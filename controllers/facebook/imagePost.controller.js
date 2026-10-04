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

export const createImagePost = async (req, res) => {
    let temporaryCloudinaryId = null;

    try {
        const {
            pageId: requestedPageId,
            caption,
            text,
            imageUrl
        } = req.body;

        const metadata = buildPostMetadata({ content: caption || text || "", platform: "facebook", metadata: req.body.metadata });
        const postCaption = contentWithHashtags(caption || text || "", metadata);

        const file = req.file || (req.files && req.files.find((f) => f.fieldname === "image" || f.fieldname === "file")) || (req.files && req.files[0]);

        if (!file && !imageUrl) {
            return res.status(400).json({
                success: false,
                message: "Upload an image or provide imageUrl"
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

        let finalImageUrl = imageUrl;

        // If local file uploaded, upload to Cloudinary temporary storage first
        if (file) {
            const uploaded = await uploadTemporaryMedia(file.buffer, {
                resourceType: "image",
                filename: file.originalname
            });
            finalImageUrl = uploaded.secure_url;
            temporaryCloudinaryId = uploaded.public_id;
        }

        // Post to Facebook Page /photos
        const response = await axios.post(
            `${GRAPH_URL}/${pageId}/photos`,
            null,
            {
                params: {
                    url: finalImageUrl,
                    caption: postCaption,
                    access_token: pageAccessToken
                }
            }
        );

        const platformPostId = response.data?.post_id || response.data?.id;

        // Record post in DB
        await recordFacebookPost({
            userId: fbData.userId,
            socialAccountId: fbData.account._id,
            platformPostId,
            postType: "image",
            message: postCaption,
            mediaUrls: finalImageUrl ? [finalImageUrl] : [],
            pageId
        });

        return res.json({
            success: true,
            message: `Facebook image post published to "${pageName}"`,
            postId: platformPostId,
            pageId,
            pageName,
            data: response.data
        });
    } catch (error) {
        console.error("Facebook Image Error:", error.response?.data || error.message);
        const fbErrMsg = error.response?.data?.error?.message;

        return res.status(error.response?.status || 500).json({
            success: false,
            message: fbErrMsg || error.message || "Facebook image post failed",
            facebookError: error.response?.data?.error || error.response?.data,
            error: error.message
        });
    } finally {
        // Enforce Cloudinary temporary lifecycle: delete asset immediately after posting
        if (temporaryCloudinaryId) {
            deleteTemporaryMedia(temporaryCloudinaryId, "image").catch((err) => {
                console.warn("[Cloudinary Cleanup Error]:", err.message);
            });
        }
    }
};