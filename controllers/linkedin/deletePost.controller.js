import axios from "axios";
import { getLinkedInAccount } from "./helpers.js";
import LinkedInPost from "../../models/linkedinPost.model.js";
import Post from "../../models/post.model.js";

// ========================================
// Delete LinkedIn Post
// DELETE /api/social/linkedin/post/:postId
// ========================================

export const deleteLinkedInPost = async (req, res) => {
    try {
        const { postId } = req.params;

        if (!postId) {
            return res.status(400).json({
                success: false,
                message: "Post ID is required"
            });
        }

        const linkedInData = await getLinkedInAccount(req);
        if (!linkedInData) {
            return res.status(404).json({
                success: false,
                message: "LinkedIn account not connected"
            });
        }

        const { accessToken, version: LINKEDIN_VERSION } = linkedInData;

        const encodedPostId = encodeURIComponent(postId);

        try {
            await axios.delete(
                `https://api.linkedin.com/rest/posts/${encodedPostId}`,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "LinkedIn-Version": LINKEDIN_VERSION,
                        "X-Restli-Protocol-Version": "2.0.0"
                    }
                }
            );
        } catch (apiErr) {
            // Even if remote delete returns 404, proceed with local cleanup
            console.warn("LinkedIn remote delete warning:", apiErr.response?.data || apiErr.message);
        }

        // Cleanup local DB records
        await LinkedInPost.findOneAndDelete({ linkedinPostId: postId });
        await Post.findOneAndDelete({ platformPostId: postId });

        return res.status(200).json({
            success: true,
            message: "LinkedIn post deleted successfully",
            postId
        });
    } catch (error) {
        console.error("Delete LinkedIn Post Error:", error.response?.data || error.message);
        return res.status(error.response?.status || 500).json({
            success: false,
            message: "Failed to delete LinkedIn post",
            error: error.response?.data || error.message
        });
    }
};