import axios from "axios";

const BASE_URL = "http://localhost:8000";

const results = [];

const logResult = (name, passed, details) => {
    results.push({ name, passed, details });
    const status = passed ? " PASS " : " FAIL ";
    console.log(`[${status}] ${name} - ${details}`);
};

const runTests = async () => {
    console.log("==================================================");
    console.log("    STARTING EXPANDED MASTER API TEST SUITE       ");
    console.log("==================================================\n");

    const client = axios.create({
        baseURL: BASE_URL,
        validateStatus: () => true // Allow checking all response codes
    });

    let token = null;
    let userId = null;
    let createdPostId = null;
    let scheduledPostId = null;
    let queuedItemId = null;

    // 1. Health check
    try {
        const res = await client.get("/");
        logResult(
            "GET / (Health Check)",
            res.status === 200 && res.data?.status === "healthy",
            `Status: ${res.status}, Services: ${res.data?.services?.length}`
        );
    } catch (e) {
        logResult("GET / (Health Check)", false, e.message);
    }

    // 2. Auth: Register
    const testEmail = `master_test_${Date.now()}@example.com`;
    const testPassword = "Password123!";
    try {
        const res = await client.post("/api/auth/register", {
            name: "Master Tester",
            email: testEmail,
            password: testPassword
        });
        const success = res.status === 201 && !!res.data?.token;
        if (success) {
            token = res.data.token;
            userId = res.data.user?.id;
        }
        logResult(
            "POST /api/auth/register",
            success,
            `Status: ${res.status}, User ID: ${userId}`
        );
    } catch (e) {
        logResult("POST /api/auth/register", false, e.message);
    }

    // 3. Auth: Login
    try {
        const res = await client.post("/api/auth/login", {
            email: testEmail,
            password: testPassword
        });
        const success = res.status === 200 && !!res.data?.token;
        if (success && !token) token = res.data.token;
        logResult(
            "POST /api/auth/login",
            success,
            `Status: ${res.status}, Token received: ${Boolean(res.data?.token)}`
        );
    } catch (e) {
        logResult("POST /api/auth/login", false, e.message);
    }

    // Auth Header
    const authHeaders = {
        headers: { Authorization: `Bearer ${token}` }
    };

    // 4. User: Profile
    try {
        const res = await client.get("/api/user/profile", authHeaders);
        logResult(
            "GET /api/user/profile",
            res.status === 200 && res.data?.user?.email === testEmail,
            `Status: ${res.status}, User: ${res.data?.user?.name}`
        );
    } catch (e) {
        logResult("GET /api/user/profile", false, e.message);
    }

    // 5. User: Limits
    try {
        const res = await client.get("/api/user/limits?platform=linkedin", authHeaders);
        logResult(
            "GET /api/user/limits",
            res.status === 200 && res.data?.limits?.platform === "linkedin",
            `Status: ${res.status}, Limit: ${res.data?.limits?.limit}, Used: ${res.data?.limits?.used}`
        );
    } catch (e) {
        logResult("GET /api/user/limits", false, e.message);
    }

    // 6. Preferences: Get
    try {
        const res = await client.get("/api/preferences", authHeaders);
        logResult(
            "GET /api/preferences",
            res.status === 200 && !!res.data?.preferences,
            `Status: ${res.status}, Automation Level: ${res.data?.preferences?.automationLevel}`
        );
    } catch (e) {
        logResult("GET /api/preferences", false, e.message);
    }

    // 7. Preferences: Update (PUT)
    try {
        const res = await client.put("/api/preferences", {
            industryNiche: "Artificial Intelligence",
            brandName: "AutoSocial AI",
            automationLevel: "Full Auto",
            preferredPlatforms: ["linkedin", "x", "facebook"]
        }, authHeaders);
        logResult(
            "PUT /api/preferences",
            res.status === 200 && res.data?.preferences?.automationLevel === "Full Auto",
            `Status: ${res.status}, Updated Brand: ${res.data?.preferences?.brandName}`
        );
    } catch (e) {
        logResult("PUT /api/preferences", false, e.message);
    }

    // 8. Social Accounts: Get Connected
    try {
        const res = await client.get("/api/social/accounts", authHeaders);
        logResult(
            "GET /api/social/accounts",
            res.status === 200 && Array.isArray(res.data?.accounts),
            `Status: ${res.status}, Accounts: ${res.data?.accounts?.length}`
        );
    } catch (e) {
        logResult("GET /api/social/accounts", false, e.message);
    }

    // 9. Posts: Create Draft
    try {
        const res = await client.post("/api/posts", {
            contentText: "Master test draft post content #test #fyp",
            platform: "linkedin"
        }, authHeaders);
        const success = res.status === 201 && res.data?.post?.status === "draft";
        if (success) createdPostId = res.data.post._id;
        logResult(
            "POST /api/posts (Create Draft)",
            success,
            `Status: ${res.status}, Post ID: ${createdPostId}`
        );
    } catch (e) {
        logResult("POST /api/posts (Create Draft)", false, e.message);
    }

    // 10. Posts: Create Scheduled
    try {
        const futureDate = new Date(Date.now() + 3600000).toISOString();
        const res = await client.post("/api/posts", {
            contentText: "Master scheduled test post for next hour",
            platform: "x",
            scheduledAt: futureDate
        }, authHeaders);
        const success = res.status === 201 && res.data?.isScheduled;
        if (success) scheduledPostId = res.data.post._id;
        logResult(
            "POST /api/posts (Create Scheduled)",
            success,
            `Status: ${res.status}, ScheduledPost ID: ${scheduledPostId}`
        );
    } catch (e) {
        logResult("POST /api/posts (Create Scheduled)", false, e.message);
    }

    // 11. Posts: Get All
    try {
        const res = await client.get("/api/posts", authHeaders);
        logResult(
            "GET /api/posts",
            res.status === 200 && Array.isArray(res.data?.posts),
            `Status: ${res.status}, Posts: ${res.data?.posts?.length}, Scheduled: ${res.data?.scheduledPosts?.length}`
        );
    } catch (e) {
        logResult("GET /api/posts", false, e.message);
    }

    // 12. Posts: Get Scheduled Posts
    try {
        const res = await client.get("/api/posts/scheduled", authHeaders);
        logResult(
            "GET /api/posts/scheduled",
            res.status === 200 && Array.isArray(res.data?.scheduledPosts),
            `Status: ${res.status}, Count: ${res.data?.scheduledPosts?.length}`
        );
    } catch (e) {
        logResult("GET /api/posts/scheduled", false, e.message);
    }

    // 13. Posts: Retry Scheduled Post
    if (scheduledPostId) {
        try {
            const res = await client.post(`/api/posts/scheduled/${scheduledPostId}/retry`, {}, authHeaders);
            logResult(
                "POST /api/posts/scheduled/:id/retry",
                res.status === 200 && res.data?.success,
                `Status: ${res.status}, Post Status: ${res.data?.post?.status}`
            );
        } catch (e) {
            logResult("POST /api/posts/scheduled/:id/retry", false, e.message);
        }
    }

    // 14. Posts: Content Ingestion / Fetch
    try {
        const res = await client.post("/api/posts/queue/fetch", {
            topic: "Generative AI and Agentic Automation",
            source: "discovery"
        }, authHeaders);
        const success = res.status === 201 && res.data?.items?.length > 0;
        if (success) queuedItemId = res.data.items[0]._id;
        logResult(
            "POST /api/posts/queue/fetch",
            success,
            `Status: ${res.status}, Ingested count: ${res.data?.count}`
        );
    } catch (e) {
        logResult("POST /api/posts/queue/fetch", false, e.message);
    }

    // 15. Posts: Get Content Queue
    try {
        const res = await client.get("/api/posts/queue", authHeaders);
        logResult(
            "GET /api/posts/queue",
            res.status === 200 && Array.isArray(res.data?.queue),
            `Status: ${res.status}, Queue count: ${res.data?.queue?.length}`
        );
    } catch (e) {
        logResult("GET /api/posts/queue", false, e.message);
    }

    // 16. Posts: Approve Queue Item
    if (queuedItemId) {
        try {
            const res = await client.post(`/api/posts/queue/${queuedItemId}/approve`, {}, authHeaders);
            logResult(
                "POST /api/posts/queue/:id/approve",
                res.status === 200 && res.data?.item?.status === "approved",
                `Status: ${res.status}, New Status: ${res.data?.item?.status}`
            );
        } catch (e) {
            logResult("POST /api/posts/queue/:id/approve", false, e.message);
        }
    }

    // 17. Calendar: Get Events
    try {
        const res = await client.get("/api/calendar", authHeaders);
        logResult(
            "GET /api/calendar",
            res.status === 200 && Array.isArray(res.data?.events),
            `Status: ${res.status}, Events returned: ${res.data?.events?.length}`
        );
    } catch (e) {
        logResult("GET /api/calendar", false, e.message);
    }

    // 18. Analytics: Get Overview
    try {
        const res = await client.get("/api/analytics", authHeaders);
        logResult(
            "GET /api/analytics",
            res.status === 200 && res.data?.totals !== undefined,
            `Status: ${res.status}, Total Views: ${res.data?.totals?.views}, Scheduled: ${res.data?.totals?.scheduledPosts}`
        );
    } catch (e) {
        logResult("GET /api/analytics", false, e.message);
    }

    // 19. AI: Generate Post Content
    try {
        const res = await client.post("/api/ai/generate", {
            topic: "Autonomous Social Media Growth with AI",
            platform: "linkedin",
            tone: "Inspiring"
        }, authHeaders);
        const success = res.status === 200 && Boolean(res.data?.content);
        logResult(
            "POST /api/ai/generate (Live Groq LLM)",
            success,
            `Status: ${res.status}, Generated Chars: ${res.data?.content?.length}`
        );
    } catch (e) {
        logResult("POST /api/ai/generate (Live Groq LLM)", false, e.message);
    }

    // 20. AI: Moderate
    try {
        const res = await client.post("/api/ai/moderate", {
            content: "Excited to introduce our social media scheduler for automated multi-channel growth!",
            platforms: ["linkedin", "x"]
        }, authHeaders);
        logResult(
            "POST /api/ai/moderate",
            res.status === 200 && typeof res.data?.isSafe === "boolean",
            `Status: ${res.status}, isSafe: ${res.data?.isSafe}`
        );
    } catch (e) {
        logResult("POST /api/ai/moderate", false, e.message);
    }

    // 20. AI: Logs
    try {
        const res = await client.get("/api/ai/logs", authHeaders);
        logResult(
            "GET /api/ai/logs",
            res.status === 200 && Array.isArray(res.data?.logs),
            `Status: ${res.status}, Logs count: ${res.data?.logs?.length}`
        );
    } catch (e) {
        logResult("GET /api/ai/logs", false, e.message);
    }

    // 21. Webhooks: Post Status Callback
    if (scheduledPostId) {
        try {
            const res = await client.post("/api/webhooks/post-status", {
                postId: scheduledPostId,
                status: "published",
                externalPostId: "ext-post-mock-12345"
            }, {
                headers: { "x-webhook-secret": process.env.WEBHOOK_SECRET || "socialsync_super_secret_123" }
            });
            logResult(
                "POST /api/webhooks/post-status",
                res.status === 200 && res.data?.success,
                `Status: ${res.status}, Post Status: ${res.data?.post?.status}`
            );
        } catch (e) {
            logResult("POST /api/webhooks/post-status", false, e.message);
        }
    }

    // 22. Social: LinkedIn Connect URL
    try {
        const res = await client.get("/api/social/linkedin/connect", { maxRedirects: 0 });
        const redirectUrl = res.headers.location || "";
        const isLinkedIn = res.status === 302 && redirectUrl.includes("linkedin.com/oauth");
        logResult("GET /api/social/linkedin/connect", isLinkedIn, `Status: ${res.status}, Location: LinkedIn OAuth`);
    } catch (e) {
        logResult("GET /api/social/linkedin/connect", false, e.message);
    }

    // 23. Social: Facebook Connect URL
    try {
        const res = await client.get("/api/social/facebook/connect", { maxRedirects: 0 });
        const redirectUrl = res.headers.location || "";
        const isFB = res.status === 302 && redirectUrl.includes("facebook.com");
        logResult("GET /api/social/facebook/connect", isFB, `Status: ${res.status}, Location: Facebook OAuth`);
    } catch (e) {
        logResult("GET /api/social/facebook/connect", false, e.message);
    }

    // 24. Social: Instagram Connect URL
    try {
        const res = await client.get("/api/social/instagram/connect", { maxRedirects: 0 });
        const redirectUrl = res.headers.location || "";
        const isIG = res.status === 302 && redirectUrl.includes("instagram.com/oauth");
        logResult("GET /api/social/instagram/connect", isIG, `Status: ${res.status}, Location: Instagram OAuth`);
    } catch (e) {
        logResult("GET /api/social/instagram/connect", false, e.message);
    }

    // 25. Social: X / Twitter Connect URL
    try {
        const res = await client.get("/api/social/x/connect", { maxRedirects: 0 });
        const redirectUrl = res.headers.location || "";
        const isX = res.status === 302 && redirectUrl.includes("x.com/i/oauth2/authorize");
        logResult("GET /api/social/x/connect", isX, `Status: ${res.status}, Location: Twitter/X PKCE OAuth`);
    } catch (e) {
        logResult("GET /api/social/x/connect", false, e.message);
    }

    // 26. Posts: Delete Draft Post
    if (createdPostId) {
        try {
            const res = await client.delete(`/api/posts/${createdPostId}`, authHeaders);
            logResult(
                "DELETE /api/posts/:id",
                res.status === 200 && res.data?.success,
                `Status: ${res.status}, Message: "${res.data?.message}"`
            );
        } catch (e) {
            logResult("DELETE /api/posts/:id", false, e.message);
        }
    }

    console.log("\n==================================================");
    const passedCount = results.filter(r => r.passed).length;
    const totalCount = results.length;
    console.log(`TEST SUMMARY: ${passedCount}/${totalCount} TESTS PASSED`);
    console.log("==================================================");

    process.exit(passedCount === totalCount ? 0 : 1);
};

runTests();
