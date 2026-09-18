import axios from "axios";
import SocialAccount from "../../models/socialAccount.model.js";
import LinkedInPost from "../../models/linkedinPost.model.js";
import LinkedInAnalytics from "../../models/linkedinAnalytics.model.js";
import { getLinkedInAccount } from "./helpers.js";


const LINKEDIN_VERSION = process.env.LINKEDIN_VERSION || "202608";

const HEADERS = (token) => ({
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": LINKEDIN_VERSION,
    "X-Restli-Protocol-Version": "2.0.0"
});


// =====================================================
// DEBUG — GET /api/social/linkedin/debug?postUrn=xxx
// Call this to see EXACTLY what LinkedIn APIs return
// =====================================================

export const debugLinkedInAPIs = async (req, res) => {
    try {
        const postUrn = req.query.postUrn || "urn:li:share:7500841249860628481";
        const linkedInData = await getLinkedInAccount(req);

        if (!linkedInData) {
            return res.status(404).json({ error: "No LinkedIn account connected" });
        }

        const { account, accessToken: token, author: authorUrn } = linkedInData;

        const encodedUrn = encodeURIComponent(postUrn);
        const results = {};


        // ---- 1. GET /rest/posts?q=author (first page only) ----
        try {
            const r = await axios.get("https://api.linkedin.com/rest/posts", {
                params: { author: authorUrn, q: "author", count: 5 },
                headers: HEADERS(token)
            });
            results.postsAPI = {
                status: r.status,
                paging: r.data?.paging,
                elementCount: r.data?.elements?.length,
                firstElement: r.data?.elements?.[0]
            };
        } catch (e) {
            results.postsAPI = {
                status: e.response?.status,
                error: e.response?.data || e.message
            };
        }


        // ---- 2. GET /rest/reactions/{postUrn} ----
        try {
            const r = await axios.get(
                `https://api.linkedin.com/rest/reactions/${encodedUrn}`,
                {
                    params: { count: 10 },
                    headers: HEADERS(token)
                }
            );
            results.reactionsAPI = {
                status: r.status,
                paging: r.data?.paging,
                elementCount: r.data?.elements?.length,
                rawData: r.data
            };
        } catch (e) {
            results.reactionsAPI = {
                status: e.response?.status,
                error: e.response?.data || e.message
            };
        }


        // ---- 3. GET /rest/comments?objectUrn=... ----
        try {
            const r = await axios.get("https://api.linkedin.com/rest/comments", {
                params: { objectUrn: postUrn, count: 10 },
                headers: HEADERS(token)
            });
            results.commentsObjectUrn = {
                status: r.status,
                paging: r.data?.paging,
                elementCount: r.data?.elements?.length,
                rawData: r.data
            };
        } catch (e) {
            results.commentsObjectUrn = {
                status: e.response?.status,
                error: e.response?.data || e.message
            };
        }


        // ---- 4. GET /rest/comments?actor=... ----
        try {
            const r = await axios.get("https://api.linkedin.com/rest/comments", {
                params: { actor: authorUrn, count: 10 },
                headers: HEADERS(token)
            });
            results.commentsActor = {
                status: r.status,
                paging: r.data?.paging,
                elementCount: r.data?.elements?.length,
                rawData: r.data
            };
        } catch (e) {
            results.commentsActor = {
                status: e.response?.status,
                error: e.response?.data || e.message
            };
        }


        // ---- 5. GET /rest/socialActions/{postUrn} ----
        try {
            const r = await axios.get(
                `https://api.linkedin.com/rest/socialActions/${encodedUrn}`,
                { headers: HEADERS(token) }
            );
            results.socialActions = {
                status: r.status,
                rawData: r.data
            };
        } catch (e) {
            results.socialActions = {
                status: e.response?.status,
                error: e.response?.data || e.message
            };
        }


        // ---- 6. GET /rest/posts/{postUrn} (single post) ----
        try {
            const r = await axios.get(
                `https://api.linkedin.com/rest/posts/${encodedUrn}`,
                { headers: HEADERS(token) }
            );
            results.singlePost = {
                status: r.status,
                rawData: r.data
            };
        } catch (e) {
            results.singlePost = {
                status: e.response?.status,
                error: e.response?.data || e.message
            };
        }


        // ---- 7. memberCreatorPostAnalytics ----
        try {
            const r = await axios.get(
                "https://api.linkedin.com/rest/memberCreatorPostAnalytics",
                {
                    params: { q: "entity", entity: postUrn },
                    headers: HEADERS(token)
                }
            );
            results.memberCreatorPostAnalytics = {
                status: r.status,
                rawData: r.data
            };
        } catch (e) {
            results.memberCreatorPostAnalytics = {
                status: e.response?.status,
                error: e.response?.data || e.message
            };
        }


        return res.json({
            success: true,
            testedPostUrn: postUrn,
            authorUrn,
            linkedinVersion: LINKEDIN_VERSION,
            results
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }

};


// =====================================================
// HELPER: Fetch ALL posts from LinkedIn (paginated)
// =====================================================

async function fetchAllLinkedInPosts(accessToken, authorUrn) {

    const allPosts = [];
    let start = 0;
    const count = 100;

    while (true) {

        console.log(`  [Sync] start=${start}`);

        const response = await axios.get(
            "https://api.linkedin.com/rest/posts",
            {
                params: { author: authorUrn, q: "author", start, count },
                headers: HEADERS(accessToken)
            }
        );

        const elements = response.data?.elements || [];
        const paging = response.data?.paging;

        allPosts.push(...elements);

        console.log(`  [Sync] got ${elements.length} | total: ${allPosts.length}`);

        if (
            elements.length === 0 ||
            elements.length < count ||
            (paging?.total != null && allPosts.length >= paging.total)
        ) {
            break;
        }

        start += count;

    }

    return allPosts;

}


// =====================================================
// HELPER: Count reactions for a post URN
// Tries paging.total THEN elements.length
// =====================================================

async function countReactions(accessToken, postUrn) {

    try {

        const encoded = encodeURIComponent(postUrn);
        const res = await axios.get(
            `https://api.linkedin.com/rest/reactions/${encoded}`,
            {
                params: { count: 50 },
                headers: HEADERS(accessToken)
            }
        );

        // LinkedIn may return paging.total OR just elements array
        const total = res.data?.paging?.total;
        if (total != null) return total;

        // Fallback: count elements
        return res.data?.elements?.length || 0;

    } catch (err) {
        console.log(
            `  [reactions] ${err.response?.status}`,
            JSON.stringify(err.response?.data || err.message)
        );
        return 0;
    }

}


// =====================================================
// HELPER: Count comments for a post URN
// =====================================================

async function countComments(accessToken, postUrn) {

    try {

        const res = await axios.get(
            "https://api.linkedin.com/rest/comments",
            {
                params: { objectUrn: postUrn, count: 50 },
                headers: HEADERS(accessToken)
            }
        );

        const total = res.data?.paging?.total;
        if (total != null) return total;

        return res.data?.elements?.length || 0;

    } catch (err) {
        console.log(
            `  [comments] ${err.response?.status}`,
            JSON.stringify(err.response?.data || err.message)
        );
        return 0;
    }

}


// =====================================================
// HELPER: Full analytics for one post
// =====================================================

async function fetchPostAnalytics(accessToken, postUrn) {

    // Attempt 1: memberCreatorPostAnalytics (needs creator scope)
    try {

        const r = await axios.get(
            "https://api.linkedin.com/rest/memberCreatorPostAnalytics",
            {
                params: { q: "entity", entity: postUrn },
                headers: HEADERS(accessToken)
            }
        );

        const data = r.data;
        const raw = Array.isArray(data?.elements) && data.elements.length > 0
            ? data.elements[0]
            : data;

        if (raw && (raw.impressionCount != null || raw.likeCount != null)) {
            return {
                impressions: raw.impressionCount || 0,
                likes: raw.likeCount || 0,
                comments: raw.commentCount || 0,
                shares: raw.shareCount || 0,
                source: "memberCreatorPostAnalytics"
            };
        }

    } catch (e) {
        console.log(
            `  [analytics-1] memberCreatorPostAnalytics ${e.response?.status}:`,
            JSON.stringify(e.response?.data?.message || e.message)
        );
    }

    // Attempt 2: reactions + comments APIs (w_member_social scope)
    const [likes, comments] = await Promise.all([
        countReactions(accessToken, postUrn),
        countComments(accessToken, postUrn)
    ]);

    return {
        impressions: 0,
        likes,
        comments,
        shares: 0,
        source: "reactions+comments"
    };

}


// =====================================================
// GET LINKEDIN ANALYTICS
// GET /api/social/linkedin/analytics
// =====================================================

export const getLinkedInFullAnalytics = async (req, res) => {
    try {
        console.log("======================================");
        console.log("FETCHING LINKEDIN ANALYTICS");
        console.log("======================================");

        const linkedInData = await getLinkedInAccount(req);

        if (!linkedInData) {
            return res.status(404).json({
                success: false,
                message: "LinkedIn account not connected"
            });
        }

        const { account: linkedinAccount, accessToken, author: authorUrn } = linkedInData;

        if (!accessToken) {
            return res.status(401).json({
                success: false,
                message: "LinkedIn access token missing"
            });
        }



        // ==========================================
        // 1. Sync posts from LinkedIn (all pages)
        // ==========================================

        let livePostsSynced = 0;

        try {

            const liveElements = await fetchAllLinkedInPosts(accessToken, authorUrn);
            livePostsSynced = liveElements.length;

            for (const elem of liveElements) {

                const postId = elem.id;
                if (!postId) continue;

                const visibility = typeof elem.visibility === "string"
                    ? elem.visibility
                    : (elem.visibility?.memberNetworkVisibility || "PUBLIC");

                await LinkedInPost.findOneAndUpdate(
                    {
                        socialAccountId: linkedinAccount._id,
                        linkedinPostId: postId
                    },
                    {
                        $set: {
                            userId: req.userId,
                            socialAccountId: linkedinAccount._id,
                            linkedinPostId: postId,
                            authorUrn,
                            commentary: elem.commentary || "",
                            lifecycleState: elem.lifecycleState || "PUBLISHED",
                            visibility,
                            publishedAt: elem.publishedAt
                                ? new Date(elem.publishedAt)
                                : (elem.createdAt ? new Date(elem.createdAt) : new Date())
                        }
                    },
                    { upsert: true, new: true }
                );

            }

            console.log(`Synced ${livePostsSynced} posts into DB`);

        } catch (syncErr) {
            console.error(
                "[PostSync] Failed:",
                syncErr.response?.status,
                JSON.stringify(syncErr.response?.data || syncErr.message)
            );
        }


        // ==========================================
        // 2. Load all posts from DB
        // ==========================================

        const dbPosts = await LinkedInPost
            .find({
                $or: [
                    { socialAccountId: linkedinAccount._id },
                    { userId: req.userId }
                ]
            })
            .sort({ publishedAt: -1, createdAt: -1 });

        console.log(`DB posts: ${dbPosts.length}`);


        // ==========================================
        // 3. Fetch analytics for each post
        // ==========================================

        let totalImpressions = 0;
        let totalReactions = 0;
        let totalComments = 0;
        let totalReshares = 0;

        const analyticsResults = [];

        for (const post of dbPosts) {

            const postUrn = post.linkedinPostId;
            console.log(`\n[Post] ${postUrn}`);

            const { impressions, likes, comments, shares, source } =
                await fetchPostAnalytics(accessToken, postUrn);

            console.log(`  imp=${impressions} lk=${likes} cm=${comments} sh=${shares} src=${source}`);

            totalImpressions += impressions;
            totalReactions += likes;
            totalComments += comments;
            totalReshares += shares;

            try {
                await LinkedInAnalytics.findOneAndUpdate(
                    {
                        socialAccountId: linkedinAccount._id,
                        linkedinPostId: postUrn
                    },
                    {
                        $set: {
                            userId: req.userId,
                            socialAccountId: linkedinAccount._id,
                            postId: post._id,
                            linkedinPostId: postUrn,
                            impressions,
                            reactions: likes,
                            comments,
                            reshares: shares,
                            fetchedAt: new Date()
                        }
                    },
                    { upsert: true, new: true }
                );
            } catch (dbErr) {
                console.error("Failed to save LinkedInAnalytics:", dbErr.message);
            }

            analyticsResults.push({
                postId: post._id,
                linkedinPostId: postUrn,
                impressions,
                likes,
                comments,
                shares,
                commentary: post.commentary || "",
                publishedAt: post.publishedAt || post.createdAt,
                analyticsSource: source
            });

        }


        // ==========================================
        // 4. Calculate engagement rate
        // ==========================================

        const totalEngagements = totalReactions + totalComments + totalReshares;
        let engagementRate = 0;

        if (totalImpressions > 0) {
            engagementRate = (totalEngagements / totalImpressions) * 100;
        } else if (dbPosts.length > 0 && totalEngagements > 0) {
            engagementRate = totalEngagements / dbPosts.length;
        }


        return res.json({
            success: true,
            message: "LinkedIn analytics fetched successfully",
            account: {
                id: linkedinAccount._id,
                name: linkedinAccount.name,
                picture: linkedinAccount.picture,
                platform: linkedinAccount.platform,
                platformUserId: linkedinAccount.platformUserId
            },
            summary: {
                totalPosts: dbPosts.length,
                livePostsSynced,
                totalImpressions,
                totalReactions,
                totalComments,
                totalReshares,
                engagementRate: Number(engagementRate.toFixed(2))
            },
            posts: analyticsResults
        });

    } catch (error) {

        console.error("Analytics Error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch LinkedIn analytics",
            error: error.message
        });

    }

};
