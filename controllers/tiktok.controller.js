import axios from "axios";
import jwt from "jsonwebtoken";
import SocialAccount from "../models/socialAccount.model.js";

const API_BASE = "https://open.tiktokapis.com/v2";
const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY || process.env.TIKTOK_CLIENT_ID;
const REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

const getUserIdFromState = (state) => {
    if (!state) return null;
    try {
        const decoded = jwt.verify(state, process.env.JWT_SECRET);
        return (decoded.id || decoded._id || decoded.userId)?.toString() || null;
    } catch {
        return null;
    }
};

const getAccount = async (userId) => SocialAccount.findOne({ platform: "tiktok", userId });

export const connectTikTok = (req, res) => {
    if (!CLIENT_KEY || !REDIRECT_URI) {
        return res.status(500).json({ success: false, message: "TikTok OAuth is not configured" });
    }
    const token = req.query.token || req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "Authentication token required" });
    const params = new URLSearchParams({
        client_key: CLIENT_KEY,
        response_type: "code",
        scope: "user.info.basic,video.publish",
        redirect_uri: REDIRECT_URI,
        state: token
    });
    return res.redirect(`https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`);
};

export const tikTokCallback = async (req, res) => {
    const { code, state, error, error_description } = req.query;
    if (error) return res.redirect(`${FRONTEND_URL}/dashboard/connect?error=${encodeURIComponent(error_description || error)}`);
    const userId = getUserIdFromState(state);
    if (!userId || !code) return res.redirect(`${FRONTEND_URL}/dashboard/connect?error=TikTok+authorization+failed`);

    try {
        const params = new URLSearchParams({
            client_key: CLIENT_KEY,
            client_secret: process.env.TIKTOK_CLIENT_SECRET,
            code,
            grant_type: "authorization_code",
            redirect_uri: REDIRECT_URI
        });
        const tokenResponse = await axios.post(`${API_BASE}/oauth/token/`, params.toString(), {
            headers: { "Content-Type": "application/x-www-form-urlencoded" }
        });
        const token = tokenResponse.data;
        const profile = await axios.get(`${API_BASE}/user/info/?fields=open_id,display_name,avatar_url`, {
            headers: { Authorization: `Bearer ${token.access_token}` }
        });
        const user = profile.data?.data?.user || {};
        await SocialAccount.findOneAndUpdate(
            { platform: "tiktok", userId },
            {
                userId,
                platform: "tiktok",
                platformUserId: token.open_id || user.open_id,
                accessToken: token.access_token,
                refreshToken: token.refresh_token,
                tokenExpiresAt: token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1000) : null,
                name: user.display_name || "TikTok",
                username: user.display_name || "TikTok",
                profileImage: user.avatar_url,
                metadata: { ...user, scope: token.scope }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        return res.redirect(`${FRONTEND_URL}/dashboard/connect?connected=tiktok&name=${encodeURIComponent(user.display_name || "TikTok")}`);
    } catch (err) {
        console.error("TikTok OAuth callback failed:", err.response?.data || err.message);
        return res.redirect(`${FRONTEND_URL}/dashboard/connect?error=${encodeURIComponent("TikTok connection failed")}`);
    }
};

export const getTikTokCreator = async (req, res) => {
    try {
        const account = await getAccount(req.userId);
        if (!account?.accessToken) return res.status(404).json({ message: "TikTok account not connected" });
        const response = await axios.post(`${API_BASE}/post/publish/creator_info/query/`, {}, {
            headers: { Authorization: `Bearer ${account.accessToken}`, "Content-Type": "application/json" }
        });
        return res.json(response.data);
    } catch (err) {
        return res.status(err.response?.status || 500).json({ message: "Failed to fetch TikTok creator information", detail: err.response?.data || err.message });
    }
};

export const publishTikTokVideo = async (req, res) => {
    try {
        const account = await getAccount(req.userId);
        if (!account?.accessToken) return res.status(404).json({ message: "TikTok account not connected" });
        if (!req.file?.buffer?.length) return res.status(400).json({ message: "A video file is required" });
        const videoSize = req.file.buffer.length;
        const chunkSize = videoSize <= 64 * 1024 * 1024 ? videoSize : 10 * 1024 * 1024;
        const init = await axios.post(`${API_BASE}/post/publish/video/init/`, {
            post_info: {
                title: req.body.title || req.body.text || "Posted from SocialSync",
                privacy_level: process.env.TIKTOK_PRIVACY_LEVEL || "SELF_ONLY",
                disable_duet: req.body.disable_duet === "true",
                disable_comment: req.body.disable_comment === "true",
                disable_stitch: req.body.disable_stitch === "true"
            },
            source_info: { source: "FILE_UPLOAD", video_size: videoSize, chunk_size: chunkSize, total_chunk_count: Math.ceil(videoSize / chunkSize) }
        }, { headers: { Authorization: `Bearer ${account.accessToken}`, "Content-Type": "application/json" } });
        const { publish_id: publishId, upload_url: uploadUrl } = init.data?.data || {};
        if (!publishId || !uploadUrl) return res.status(502).json({ message: "TikTok did not return upload details", detail: init.data });
        for (let start = 0; start < videoSize; start += chunkSize) {
            const end = Math.min(start + chunkSize, videoSize);
            await axios.put(uploadUrl, req.file.buffer.subarray(start, end), {
                headers: { "Content-Type": req.file.mimetype || "video/mp4", "Content-Length": end - start, "Content-Range": `bytes ${start}-${end - 1}/${videoSize}` },
                maxBodyLength: Infinity,
                timeout: 120000
            });
        }
        return res.json({ success: true, publishId, status: "PROCESSING" });
    } catch (err) {
        const tiktokError = err.response?.data?.error;
        const status = tiktokError?.code === "unaudited_client_can_only_post_to_private_accounts" ? 403 : (err.response?.status || 500);
        return res.status(status).json({ message: tiktokError?.message || "TikTok video publishing failed", code: tiktokError?.code, detail: err.response?.data || err.message });
    }
};

export const getTikTokPublishStatus = async (req, res) => {
    try {
        const account = await getAccount(req.userId);
        if (!account?.accessToken) return res.status(404).json({ message: "TikTok account not connected" });
        const response = await axios.post(`${API_BASE}/post/publish/status/fetch/`, { publish_id: req.params.publishId }, { headers: { Authorization: `Bearer ${account.accessToken}`, "Content-Type": "application/json" } });
        return res.json(response.data);
    } catch (err) {
        return res.status(err.response?.status || 500).json({ message: "Failed to fetch TikTok publish status", detail: err.response?.data || err.message });
    }
};