import axios from "axios";
import { getLinkedInAccount, recordPublishedPost } from "./helpers.js";

// ========================================
// Create LinkedIn Document / PDF Post
// POST /api/social/linkedin/post/document
// Supports:
// - Multipart file upload (field: "document")
// - JSON body: { text, title, documentUrl }
// - JSON body: { text, title, documentBase64 }
// ========================================

export const createLinkedInDocumentPost = async (req, res) => {
    try {
        const text = req.body.text || req.body.content || req.body.commentary || "";
        const title = req.body.title || "Shared Document";

        let docBuffer = null;
        let mimeType = "application/pdf";
        let docSource = null;

        const file = req.file || (req.files && req.files.find((f) => f.fieldname === "document" || f.fieldname === "file")) || (req.files && req.files[0]);
        if (file) {
            docBuffer = file.buffer;
            mimeType = file.mimetype || "application/pdf";
            docSource = file.originalname;
        } else if (req.body.documentUrl) {
            docSource = req.body.documentUrl;
            const docRes = await axios.get(req.body.documentUrl, { responseType: "arraybuffer" });
            docBuffer = Buffer.from(docRes.data);
            mimeType = docRes.headers["content-type"] || "application/pdf";
        } else if (req.body.documentBase64) {
            const matches = req.body.documentBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                mimeType = matches[1];
                docBuffer = Buffer.from(matches[2], "base64");
            } else {
                docBuffer = Buffer.from(req.body.documentBase64, "base64");
            }
        }

        if (!docBuffer) {
            return res.status(400).json({
                success: false,
                message: "Document file or documentUrl is required"
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

        // 1. Initialize document upload
        const initRes = await axios.post(
            "https://api.linkedin.com/rest/documents?action=initializeUpload",
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
        const documentUrn = uploadData.document;

        // 2. Upload document binary
        await axios.put(uploadUrl, docBuffer, {
            headers: { "Content-Type": mimeType },
            maxBodyLength: Infinity
        });

        // 3. Create document post
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
                    id: documentUrn,
                    title: title.trim()
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
            postType: "document",
            mediaUrls: docSource ? [docSource] : [],
            content: payload
        });

        return res.status(201).json({
            success: true,
            message: "LinkedIn document post published successfully",
            postId,
            documentUrn,
            data: postRes.data
        });
    } catch (error) {
        console.error("LinkedIn Document Post Error:", error.response?.data || error.message);
        return res.status(error.response?.status || 500).json({
            success: false,
            message: "Failed to publish LinkedIn document post",
            error: error.response?.data || error.message
        });
    }
};