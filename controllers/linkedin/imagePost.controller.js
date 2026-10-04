import axios from "axios";
import { getLinkedInAccount, recordPublishedPost } from "./helpers.js";
import { buildPostMetadata, contentWithHashtags } from "../../utils/post-metadata.js";

// ========================================
// Create LinkedIn Image Post
// POST /api/social/linkedin/post/image
// Supports:
// - Multipart file upload (field: "image")
// - JSON body: { text, imageUrl }
// - JSON body: { text, imageBase64 }
// ========================================

export const createLinkedInImagePost = async (req, res) => {
    try {
        const metadata = buildPostMetadata({ content: req.body.text || req.body.content || req.body.commentary || "", platform: "linkedin", metadata: req.body.metadata });
        const text = contentWithHashtags(req.body.text || req.body.content || req.body.commentary || "", metadata);
        const title = req.body.title || "SocialSync Post";

        let imageBuffer = null;
        let mimeType = "image/png";
        let imageSource = null;

        const file = req.file || (req.files && req.files.find((f) => f.fieldname === "image" || f.fieldname === "file")) || (req.files && req.files[0]);
        if (file) {
            imageBuffer = file.buffer;
            mimeType = file.mimetype || "image/png";
            imageSource = file.originalname;
        } else if (req.body.imageUrl) {
            imageSource = req.body.imageUrl;
            const imgRes = await axios.get(req.body.imageUrl, { responseType: "arraybuffer" });
            imageBuffer = Buffer.from(imgRes.data);
            mimeType = imgRes.headers["content-type"] || "image/jpeg";
        } else if (req.body.imageBase64) {
            const matches = req.body.imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                mimeType = matches[1];
                imageBuffer = Buffer.from(matches[2], "base64");
            } else {
                imageBuffer = Buffer.from(req.body.imageBase64, "base64");
            }
        }

        if (!imageBuffer) {
            return res.status(400).json({
                success: false,
                message: "Image file or imageUrl is required"
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

        // 1. Initialize image upload
        const initRes = await axios.post(
            "https://api.linkedin.com/rest/images?action=initializeUpload",
            {
                initializeUploadRequest: {
                    owner: author
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "LinkedIn-Version": version,
                    "X-Restli-Protocol-Version": "2.0.0",
                    "Content-Type": "application/json"
                }
            }
        );

        const uploadData = initRes.data.value;
        const uploadUrl = uploadData.uploadUrl;
        const imageUrn = uploadData.image;

        // 2. Upload binary to LinkedIn upload URL
        await axios.put(uploadUrl, imageBuffer, {
            headers: { "Content-Type": mimeType },
            maxBodyLength: Infinity
        });

        // 3. Create post referencing the uploaded image URN
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
                media: {
                    id: imageUrn,
                    title: title,
                    altText: title
                }
            },
            lifecycleState: "PUBLISHED"
        };

        const postRes = await axios.post(
            "https://api.linkedin.com/rest/posts",
            payload,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "LinkedIn-Version": version,
                    "X-Restli-Protocol-Version": "2.0.0",
                    "Content-Type": "application/json"
                }
            }
        );

        const postId = postRes.headers["x-restli-id"] || postRes.data?.id;

        await recordPublishedPost({
            userId,
            socialAccountId: account._id,
            platformPostId: postId,
            commentary: text.trim(),
            postType: "image",
            mediaUrls: imageSource ? [imageSource] : [],
            content: payload
        });

        return res.status(201).json({
            success: true,
            message: "LinkedIn image post published successfully",
            postId,
            imageUrn,
            data: postRes.data
        });
    } catch (error) {
        console.error("LinkedIn Image Post Error:", error.response?.data || error.message);
        return res.status(error.response?.status || 500).json({
            success: false,
            message: "Failed to publish LinkedIn image post",
            error: error.response?.data || error.message
        });
    }
};