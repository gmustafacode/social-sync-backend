import axios from "axios";
import SocialAccount from "../models/socialAccount.model.js";
import { generateAccountSeo } from "../services/ai.service.js";

const GRAPH_API_VERSION = process.env.FACEBOOK_API_VERSION || "v25.0";

const parseMetadata = (metadata) => {
    if (!metadata) return {};
    if (typeof metadata === "object") return metadata;
    try { return JSON.parse(metadata); } catch { return {}; }
};

const cleanSeo = (seo = {}) => ({
    displayName: String(seo.displayName || "").trim(),
    headline: String(seo.headline || "").trim(),
    bio: String(seo.bio || "").trim(),
    about: String(seo.about || "").trim(),
    keywords: Array.isArray(seo.keywords) ? seo.keywords.map((item) => String(item).trim()).filter(Boolean).slice(0, 10) : [],
    website: String(seo.website || "").trim(),
    altText: String(seo.altText || "").trim(),
    callToAction: String(seo.callToAction || "").trim()
});

const findOwnedAccount = (userId, accountId) => SocialAccount.findOne({ _id: accountId, userId }).lean();

const getPlatformState = (account) => {
    const metadata = parseMetadata(account.metadata);
    return {
        accountId: account._id,
        platform: account.platform,
        name: account.name || account.username || account.platformUserId,
        username: account.username,
        picture: account.picture || account.profileImage,
        pages: account.platform === "facebook"
            ? (Array.isArray(metadata.pages) ? metadata.pages.map((page) => ({ id: page.id, name: page.name, category: page.category })) : [])
            : [],
        connected: true,
        seo: cleanSeo(metadata.seo),
        capabilities: account.platform === "facebook"
            ? { localSeo: true, profileApiWrite: true }
            : { localSeo: true, profileApiWrite: false }
    };
};

export const getAccountSeo = async (req, res) => {
    try {
        const accounts = await SocialAccount.find({
            userId: req.userId?.toString(),
            platform: { $in: ["linkedin", "facebook", "instagram"] }
        }).lean();
        res.json({ success: true, accounts: accounts.map(getPlatformState) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const generateAccountSeoContent = async (req, res) => {
    try {
        const { accountId, audience, niche } = req.body;
        const account = await findOwnedAccount(req.userId?.toString(), accountId);
        if (!account || !["linkedin", "facebook", "instagram"].includes(account.platform)) {
            return res.status(404).json({ success: false, message: "Connected account not found" });
        }
        const current = parseMetadata(account.metadata).seo || {};
        const seo = await generateAccountSeo({ platform: account.platform, accountName: account.name || account.username, current, audience, niche });
        res.json({ success: true, seo, platform: account.platform });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const saveAccountSeo = async (req, res) => {
    try {
        const userId = req.userId?.toString();
        const account = await findOwnedAccount(userId, req.params.accountId);
        if (!account || !["linkedin", "facebook", "instagram"].includes(account.platform)) {
            return res.status(404).json({ success: false, message: "Connected account not found" });
        }

        const seo = cleanSeo(req.body.seo);
        const metadata = { ...parseMetadata(account.metadata), seo, seoUpdatedAt: new Date().toISOString() };
        let platformSynced = false;
        let syncMessage = "SEO package saved in SocialSync.";

        if (account.platform === "facebook") {
            const pages = Array.isArray(metadata.pages) ? metadata.pages : [];
            const page = pages.find((item) => item.id === req.body.pageId) || pages[0];
            if (!page?.id || !page.access_token) {
                return res.status(400).json({ success: false, message: "No Facebook Page with a Page access token is connected." });
            }
            const params = {
                access_token: page.access_token,
                ...(seo.displayName ? { name: seo.displayName } : {}),
                ...(seo.about ? { about: seo.about } : {}),
                ...(seo.website ? { website: seo.website } : {})
            };
            await axios.post(`https://graph.facebook.com/${GRAPH_API_VERSION}/${page.id}`, null, { params });
            platformSynced = true;
            syncMessage = `Facebook Page "${page.name || page.id}" SEO fields updated.`;
        } else if (account.platform === "instagram") {
            syncMessage = "Instagram does not expose profile SEO writes through the connected API scope. The SEO package was saved locally for captions, hashtags and content optimization.";
        } else {
            syncMessage = "LinkedIn does not expose general profile editing through this API permission. The SEO package was saved locally and is ready to use in posts.";
        }

        await SocialAccount.updateOne({ _id: account._id, userId }, { $set: { metadata } });
        res.json({ success: true, platformSynced, syncMessage, account: getPlatformState({ ...account, metadata }) });
    } catch (error) {
        const providerMessage = error.response?.data?.error?.message;
        const isCapabilityError = /capability|permission|does not have/i.test(providerMessage || error.message || "");
        if (isCapabilityError) {
            const userId = req.userId?.toString();
            const account = await findOwnedAccount(userId, req.params.accountId);
            const seo = cleanSeo(req.body.seo);
            const metadata = { ...parseMetadata(account?.metadata), seo, seoUpdatedAt: new Date().toISOString() };
            await SocialAccount.updateOne({ _id: req.params.accountId, userId }, { $set: { metadata } });
            return res.json({
                success: true,
                platformSynced: false,
                syncMessage: "The platform API rejected profile editing for this app permission. Your SEO package was saved locally and will be used for content optimization.",
                account: account ? getPlatformState({ ...account, metadata }) : undefined
            });
        }
        res.status(error.response?.status || 500).json({ success: false, message: providerMessage || error.message });
    }
};