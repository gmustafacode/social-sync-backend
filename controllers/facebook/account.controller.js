import axios from "axios";
import SocialAccount from "../../models/socialAccount.model.js";
import { getFacebookAccount as resolveFacebookAccount } from "./helpers.js";

const GRAPH_API_VERSION = process.env.FACEBOOK_API_VERSION || "v25.0";
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/**
 * Extracts a numeric Facebook Page ID from various input formats:
 * - Direct ID: "1341429722380752"
 * - Asset ID URL: "https://web.facebook.com/latest/home?asset_id=1341429722380752"
 * - Profile URL: "https://web.facebook.com/profile.php?id=1341429722380752"
 * - Path URL: "https://web.facebook.com/1341429722380752"
 */
function extractFacebookPageId(input) {
    if (!input || typeof input !== "string") return null;
    const trimmed = input.trim();

    // Check for asset_id query param
    const assetMatch = trimmed.match(/[?&]asset_id=(\d+)/);
    if (assetMatch) return assetMatch[1];

    // Check for id query param
    const idMatch = trimmed.match(/[?&]id=(\d+)/);
    if (idMatch) return idMatch[1];

    // Check for purely numeric string
    const numericMatch = trimmed.match(/^\d+$/);
    if (numericMatch) return numericMatch[0];

    // Check for digits at end of URL path
    const pathMatch = trimmed.match(/\/(\d+)(?:\/|\?|$)/);
    if (pathMatch) return pathMatch[1];

    return null;
}

/**
 * Fetches page details and access token directly by page ID using user's access token
 */
async function fetchPageDirect(pageId, userAccessToken) {
    try {
        const res = await axios.get(`${GRAPH_URL}/${pageId}`, {
            params: {
                fields: "id,name,category,picture,access_token,followers_count,fan_count",
                access_token: userAccessToken
            }
        });
        if (res.data?.id && (res.data?.access_token || res.data?.name)) {
            return res.data;
        }
    } catch (err) {
        console.warn(`[FB Page Direct Fetch Warning] ID ${pageId}:`, err.response?.data?.error?.message || err.message);
    }
    return null;
}

// =====================================================
// GET FACEBOOK ACCOUNT
// GET /api/social/facebook/account
// =====================================================
export const getFacebookAccount = async (req, res) => {
    try {
        const fbData = await resolveFacebookAccount(req);

        if (!fbData || !fbData.account) {
            return res.status(404).json({
                success: false,
                message: "Facebook account not connected"
            });
        }

        const safeAccount = {
            _id: fbData.account._id,
            platform: fbData.account.platform,
            platformUserId: fbData.account.platformUserId,
            name: fbData.account.name,
            profileImage: fbData.account.profileImage,
            pages: fbData.pages,
            createdAt: fbData.account.createdAt
        };

        return res.json({
            success: true,
            account: safeAccount
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to get Facebook account",
            error: error.message
        });
    }
};

// =====================================================
// GET / SYNC CONNECTED PAGES
// GET /api/social/facebook/pages
// POST /api/social/facebook/sync-pages
// =====================================================
export const getFacebookPages = async (req, res) => {
    try {
        const fbData = await resolveFacebookAccount(req);

        if (!fbData?.account?.accessToken) {
            return res.status(404).json({
                success: false,
                message: "Facebook account not connected"
            });
        }

        const userAccessToken = fbData.account.accessToken;
        const shouldSync = req.query.sync === "true" || req.method === "POST";
        const inputPageTarget = req.body?.pageId || req.body?.pageUrl || req.query?.pageId || req.query?.pageUrl;

        // If not syncing and pages already exist in DB, return them immediately
        if (!shouldSync && !inputPageTarget && fbData.pages && fbData.pages.length > 0) {
            return res.json({
                success: true,
                synced: false,
                pages: fbData.pages.map((p) => ({
                    id: p.id,
                    name: p.name,
                    category: p.category,
                    tasks: p.tasks,
                    picture: p.picture
                }))
            });
        }

        // Map to store unique pages by ID
        const pagesMap = new Map();

        // 1. Preload existing pages from database
        if (Array.isArray(fbData.pages)) {
            for (const p of fbData.pages) {
                if (p?.id) pagesMap.set(p.id, p);
            }
        }

        // 2. Try querying /me/accounts from Meta
        try {
            const meAccountsRes = await axios.get(`${GRAPH_URL}/me/accounts`, {
                params: {
                    fields: "id,name,category,tasks,picture,access_token",
                    access_token: userAccessToken
                }
            });
            const fetched = meAccountsRes.data?.data || [];
            for (const p of fetched) {
                if (p?.id) pagesMap.set(p.id, p);
            }
        } catch (meErr) {
            console.warn("[FB /me/accounts warning]:", meErr.response?.data?.error?.message || meErr.message);
        }

        // 3. If a specific page ID or URL was provided, fetch and add it
        const targetPageId = extractFacebookPageId(inputPageTarget);
        if (targetPageId) {
            const directPage = await fetchPageDirect(targetPageId, userAccessToken);
            if (directPage) {
                pagesMap.set(directPage.id, directPage);
            }
        }

        // 4. Refresh existing pages directly to get fresh tokens and avoid stale credentials
        const pageIdsToRefresh = Array.from(pagesMap.keys());
        for (const pid of pageIdsToRefresh) {
            const refreshed = await fetchPageDirect(pid, userAccessToken);
            if (refreshed) {
                pagesMap.set(pid, { ...pagesMap.get(pid), ...refreshed });
            }
        }

        const finalPages = Array.from(pagesMap.values());

        // Update MongoDB if pages found or if explicit target was provided
        if (finalPages.length > 0) {
            await SocialAccount.updateOne(
                { _id: fbData.account._id },
                { $set: { "metadata.pages": finalPages } }
            );
        }

        return res.json({
            success: true,
            synced: true,
            pages: finalPages.map((p) => ({
                id: p.id,
                name: p.name,
                category: p.category,
                tasks: p.tasks,
                picture: p.picture
            }))
        });
    } catch (error) {
        console.error("[getFacebookPages Error]:", error);
        return res.status(error.response?.status || 500).json({
            success: false,
            message: "Failed to get Facebook Pages",
            facebookError: error.response?.data?.error?.message || error.response?.data,
            error: error.message
        });
    }
};

export const syncFacebookPages = getFacebookPages;