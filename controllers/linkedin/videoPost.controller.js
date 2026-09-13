import axios from "axios";
import { getLinkedInAccount, recordPublishedPost } from "./helpers.js";

/**
 * Core function to upload and publish video to LinkedIn
 */
export const publishLinkedInVideo = async ({
    author,
    accessToken,
    version,
    commentary,
    title,
    buffer,
    size
}) => {
    const LINKEDIN_VERSION = version || process.env.LINKEDIN_VERSION || "202601";

    // 1. Initialize
    const initializeResponse = await axios.post(
        "https://api.linkedin.com/rest/videos?action=initializeUpload",
        {
            initializeUploadRequest: {
                owner: author,
                fileSizeBytes: size,
                uploadCaptions: false,
                uploadThumbnail: false
            }
        },
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "LinkedIn-Version": LINKEDIN_VERSION,
                "X-Restli-Protocol-Version": "2.0.0",
                "Content-Type": "application/json"
            }
        }
    );

    const uploadData = initializeResponse.data.value;
    const videoUrn = uploadData.video;
    const instructions = uploadData.uploadInstructions;
    const uploadToken = uploadData.uploadToken || "";

    // 2. Upload all chunks/parts
    const uploadedPartIds = [];
    for (const instruction of instructions) {
        const start = Number(instruction.firstByte);
        const end = Number(instruction.lastByte);
        const chunk = buffer.slice(start, end + 1);

        const uploadResponse = await axios.put(
            instruction.uploadUrl,
            chunk,
            {
                headers: {
                    "Content-Type": "application/octet-stream",
                    "Content-Range": `bytes ${start}-${end}/${size}`
                },
                maxBodyLength: Infinity
            }
        );

        const etag = uploadResponse.headers.etag;
        if (!etag) {
            throw new Error("LinkedIn upload did not return ETag");
        }
        uploadedPartIds.push(etag);
    }

    // 3. Finalize
    await axios.post(
        "https://api.linkedin.com/rest/videos?action=finalizeUpload",
        {
            finalizeUploadRequest: {
                video: videoUrn,
                uploadToken,
                uploadedPartIds
            }
        },
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "LinkedIn-Version": LINKEDIN_VERSION,
                "X-Restli-Protocol-Version": "2.0.0",
                "Content-Type": "application/json"
            }
        }
    );

    // 4. Create Post
    const postResponse = await axios.post(
        "https://api.linkedin.com/rest/posts",
        {
            author,
            commentary: commentary || "",
            visibility: "PUBLIC",
            distribution: {
                feedDistribution: "MAIN_FEED",
                targetEntities: [],
                thirdPartyDistributionChannels: []
            },
            content: {
                media: {
                    title: title || "Video",
                    id: videoUrn
                }
            },
            lifecycleState: "PUBLISHED",
            isReshareDisabledByAuthor: false
        },
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "LinkedIn-Version": LINKEDIN_VERSION,
                "X-Restli-Protocol-Version": "2.0.0",
                "Content-Type": "application/json"
            }
        }
    );

    const postId = postResponse.headers["x-restli-id"] || postResponse.data?.id;
    return { postId, videoUrn };
};

export const createLinkedInVideoPost = async (req, res) => {
    try {
        const text = req.body.text || req.body.content || req.body.commentary || "";
        const video = req.file || (req.files && req.files.find((f) => f.fieldname === "video" || f.fieldname === "file")) || (req.files && req.files[0]);
        const videoUrl = req.body.videoUrl;

        let videoBuffer = video?.buffer;
        let videoSize = video?.size;
        let videoTitle = video?.originalname || "video.mp4";

        if (!videoBuffer && videoUrl) {
            const vidRes = await axios.get(videoUrl, { responseType: "arraybuffer", timeout: 60000 });
            videoBuffer = Buffer.from(vidRes.data);
            videoSize = videoBuffer.length;
            videoTitle = videoUrl.split("/").pop()?.split("?")[0] || "video.mp4";
        }

        if (!videoBuffer) {
            return res.status(400).json({
                success: false,
                message: "Video file or videoUrl is required"
            });
        }

        const linkedInData = await getLinkedInAccount(req);
        if (!linkedInData) {
            return res.status(404).json({
                success: false,
                message: "LinkedIn account not connected"
            });
        }

        const { account, author, accessToken, version: LINKEDIN_VERSION, userId } = linkedInData;

        const { postId, videoUrn } = await publishLinkedInVideo({
            author,
            accessToken: account.accessToken || accessToken,
            version: LINKEDIN_VERSION,
            commentary: text,
            title: videoTitle,
            buffer: videoBuffer,
            size: videoSize
        });

        if (postId) {
            await recordPublishedPost({
                userId,
                socialAccountId: account._id,
                platformPostId: postId,
                commentary: text,
                postType: "video",
                mediaUrls: [videoTitle],
                content: { author, videoUrn }
            });
        }

        return res.status(201).json({
            success: true,
            message: "LinkedIn video post published",
            videoUrn,
            postId
        });
    } catch (error) {
        console.error("LinkedIn Video Error:", error.response?.data || error.message);
        return res.status(error.response?.status || 500).json({
            success: false,
            message: error.response?.data?.message || error.message || "Failed to publish LinkedIn video",
            details: error.response?.data
        });
    }
};