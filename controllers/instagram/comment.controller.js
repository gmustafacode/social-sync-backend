import {
    instagramGraphGet,
    instagramGraphPost,
    instagramGraphDelete,
    getInstagramError
} from "../../config/instagram.js";

const handleError = (res, message, error) => res.status(error.statusCode || 500).json({ success: false, message, instagramError: getInstagramError(error), error: error.message });

export const getComments = async (req, res) => {
    try {
        const data = await instagramGraphGet(`${req.params.mediaId}/comments`, { fields: "id,text,username,timestamp,like_count,from,replies" }, req.userId);
        return res.json({ success: true, data });
    } catch (error) { return handleError(res, "Failed to get Instagram comments", error); }
};

export const createComment = async (req, res) => {
    try {
        if (!req.body.message) return res.status(400).json({ success: false, message: "message is required" });
        const data = await instagramGraphPost(`${req.params.mediaId}/comments`, { message: req.body.message }, req.userId);
        return res.json({ success: true, commentId: data.id, data });
    } catch (error) { return handleError(res, "Instagram comment failed", error); }
};

export const replyToComment = async (req, res) => {
    try {
        if (!req.body.message) return res.status(400).json({ success: false, message: "message is required" });
        const data = await instagramGraphPost(`${req.params.commentId}/replies`, { message: req.body.message }, req.userId);
        return res.json({ success: true, replyId: data.id, data });
    } catch (error) { return handleError(res, "Instagram comment reply failed", error); }
};

export const deleteComment = async (req, res) => {
    try {
        const data = await instagramGraphDelete(req.params.commentId, req.userId);
        return res.json({ success: true, message: "Instagram comment deleted", data });
    } catch (error) { return handleError(res, "Instagram comment delete failed", error); }
};
