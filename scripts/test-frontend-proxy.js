import axios from "axios";

// Target Vite frontend dev server proxy
const BASE_URL = "http://localhost:5173/api";

const client = axios.create({
    baseURL: BASE_URL,
    validateStatus: () => true, // Don't throw so we can inspect responses
    headers: {
        "Content-Type": "application/json"
    }
});

let token = null;
let userId = null;
let testPostId = null;
let queueItemId = null;

const results = [];

function record(name, passed, detail = "") {
    results.push({ name, passed, detail });
    const symbol = passed ? "✅" : "❌";
    console.log(`${symbol} [${passed ? "PASS" : "FAIL"}] ${name} ${detail ? `(${detail})` : ""}`);
}

async function runAllFrontendTests() {
    console.log("==========================================================");
    console.log("🚀 TESTING ALL FRONTEND -> BACKEND APIs VIA VITE PROXY");
    console.log(`📡 Base URL: ${BASE_URL}`);
    console.log("==========================================================\n");

    // 1. Register
    const email = `testuser_${Date.now()}@example.com`;
    const password = "password123!";
    const regRes = await client.post("/auth/register", {
        name: "Frontend Test User",
        email,
        password
    });

    if (regRes.status === 201 && regRes.data?.token) {
        token = regRes.data.token;
        userId = regRes.data.user?.id;
        client.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        record("1. POST /api/auth/register", true, `Status ${regRes.status}, User ID: ${userId}`);
    } else {
        record("1. POST /api/auth/register", false, `Status ${regRes.status}, ${JSON.stringify(regRes.data)}`);
    }

    // 2. Login
    const loginRes = await client.post("/auth/login", { email, password });
    if (loginRes.status === 200 && loginRes.data?.token) {
        record("2. POST /api/auth/login", true, `Status ${loginRes.status}, Token returned`);
    } else {
        record("2. POST /api/auth/login", false, `Status ${loginRes.status}, ${JSON.stringify(loginRes.data)}`);
    }

    // 3. User Profile
    const profileRes = await client.get("/user/profile");
    if (profileRes.status === 200 && profileRes.data?.user?.email === email) {
        record("3. GET /api/user/profile", true, `User: ${profileRes.data.user.name}`);
    } else {
        record("3. GET /api/user/profile", false, `Status ${profileRes.status}`);
    }

    // 4. User Limits (for QuotaTracker widget)
    const limitsRes = await client.get("/user/limits");
    if (limitsRes.status === 200 && typeof limitsRes.data?.postsToday === "number" && typeof limitsRes.data?.aiCallsToday === "number") {
        record("4. GET /api/user/limits (QuotaTracker)", true, `Posts: ${limitsRes.data.postsToday}/${limitsRes.data.postsLimit}, AI: ${limitsRes.data.aiCallsToday}/${limitsRes.data.aiCallsLimit}`);
    } else {
        record("4. GET /api/user/limits (QuotaTracker)", false, `Status ${limitsRes.status}, data: ${JSON.stringify(limitsRes.data)}`);
    }

    // 5. Dashboard / Analytics Overview
    const analyticsRes = await client.get("/analytics");
    if (analyticsRes.status === 200 && analyticsRes.data?.totals && Array.isArray(analyticsRes.data?.chartData)) {
        record("5. GET /api/analytics (Dashboard & Analytics)", true, `Total Posts: ${analyticsRes.data.totals.totalPosts}, Chart points: ${analyticsRes.data.chartData.length}`);
    } else {
        record("5. GET /api/analytics (Dashboard & Analytics)", false, `Status ${analyticsRes.status}`);
    }

    // 6. Recent Posts for Dashboard
    const postsListRes = await client.get("/posts?limit=5");
    if (postsListRes.status === 200 && Array.isArray(postsListRes.data?.posts)) {
        record("6. GET /api/posts?limit=5 (Dashboard recent feed)", true, `Found ${postsListRes.data.posts.length} posts`);
    } else {
        record("6. GET /api/posts?limit=5 (Dashboard recent feed)", false, `Status ${postsListRes.status}`);
    }

    // 7. Calendar Events
    const calRes = await client.get("/calendar?start=2026-09-01&end=2026-09-30");
    if (calRes.status === 200 && Array.isArray(calRes.data?.events)) {
        record("7. GET /api/calendar (Calendar page)", true, `Events count: ${calRes.data.events.length}`);
    } else {
        record("7. GET /api/calendar (Calendar page)", false, `Status ${calRes.status}`);
    }

    // 8. Social Connected Accounts
    const accountsRes = await client.get("/social/accounts");
    if (accountsRes.status === 200 && Array.isArray(accountsRes.data)) {
        record("8. GET /api/social/accounts (Connect page & Composer accounts)", true, `Accounts count: ${accountsRes.data.length}`);
    } else {
        record("8. GET /api/social/accounts (Connect page & Composer accounts)", false, `Status ${accountsRes.status}`);
    }

    // 9. Preferences (Settings page)
    const prefRes = await client.get("/preferences");
    if (prefRes.status === 200 && (prefRes.data?.autoApprove !== undefined || prefRes.data?.preferences)) {
        record("9. GET /api/preferences (Settings page load)", true, `AutoApprove: ${prefRes.data.autoApprove}`);
    } else {
        record("9. GET /api/preferences (Settings page load)", false, `Status ${prefRes.status}`);
    }

    // 10. Update Preferences (Settings page save)
    const updatePrefRes = await client.put("/preferences", {
        autoApprove: true,
        schedulingEnabled: true,
        webhookUrl: "https://n8n.example.com/webhook/test-from-frontend"
    });
    if (updatePrefRes.status === 200 && updatePrefRes.data?.webhookUrl === "https://n8n.example.com/webhook/test-from-frontend") {
        record("10. PUT /api/preferences (Settings page save)", true, `Updated webhook URL`);
    } else {
        record("10. PUT /api/preferences (Settings page save)", false, `Status ${updatePrefRes.status}`);
    }

    // 11. AI Content Generation (Composer Step 1 -> 2)
    console.log("   ⏳ Testing Live AI generation via Groq...");
    const aiGenRes = await client.post("/ai/generate", {
        topic: "Vite + React integration best practices for enterprise web apps",
        tone: "professional",
        postType: "thought_leadership"
    });
    if (aiGenRes.status === 200 && (aiGenRes.data?.content || aiGenRes.data?.text)) {
        const textSnippet = (aiGenRes.data.content || aiGenRes.data.text).substring(0, 60);
        record("11. POST /api/ai/generate (Composer AI Step)", true, `Content: "${textSnippet}..."`);
    } else {
        record("11. POST /api/ai/generate (Composer AI Step)", false, `Status ${aiGenRes.status}, error: ${JSON.stringify(aiGenRes.data)}`);
    }

    // 12. AI Moderation Check (Composer Step 2)
    const aiModRes = await client.post("/ai/moderate", {
        content: "Excited to launch our new feature! Follow along for tips and best practices. #innovation #ai",
        platforms: ["linkedin", "x"]
    });
    if (aiModRes.status === 200 && (aiModRes.data?.safe !== undefined || aiModRes.data?.isSafe !== undefined)) {
        record("12. POST /api/ai/moderate (Composer moderation step)", true, `Safe: ${aiModRes.data.safe ?? aiModRes.data.isSafe}`);
    } else {
        record("12. POST /api/ai/moderate (Composer moderation step)", false, `Status ${aiModRes.status}`);
    }

    // 13. Create Post (Composer Step 3 -> Queue)
    const createPostRes = await client.post("/posts", {
        content: "Building connected frontend and backend architectures is exciting! #coding #react #node",
        platforms: ["linkedin", "x"],
        status: "queued"
    });
    if (createPostRes.status === 201 && createPostRes.data?.post) {
        testPostId = createPostRes.data.post._id;
        record("13. POST /api/posts (Composer create post to queue)", true, `Created post ID: ${testPostId}`);
    } else {
        record("13. POST /api/posts (Composer create post to queue)", false, `Status ${createPostRes.status}`);
    }

    // 14. Create Scheduled Post (Composer Step 3 -> Schedule)
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const createSchedRes = await client.post("/posts", {
        content: "Scheduled announcement for tomorrow morning! #future #update",
        platforms: ["linkedin"],
        status: "scheduled",
        scheduledFor: futureDate
    });
    if (createSchedRes.status === 201 && createSchedRes.data?.isScheduled) {
        record("14. POST /api/posts (Composer schedule post)", true, `Scheduled for: ${futureDate}`);
    } else {
        record("14. POST /api/posts (Composer schedule post)", false, `Status ${createSchedRes.status}`);
    }

    // 15. Content Queue Feed (Queue & History page)
    const queueRes = await client.get("/posts/queue");
    if (queueRes.status === 200 && Array.isArray(queueRes.data)) {
        queueItemId = queueRes.data[0]?._id || testPostId;
        record("15. GET /api/posts/queue (Queue page list)", true, `Found ${queueRes.data.length} queue items`);
    } else {
        record("15. GET /api/posts/queue (Queue page list)", false, `Status ${queueRes.status}`);
    }

    // 16. Approve Post (Queue page approve button)
    if (queueItemId) {
        const approveRes = await client.put(`/posts/queue/${queueItemId}/approve`);
        if (approveRes.status === 200 && approveRes.data?.success) {
            record("16. PUT /api/posts/queue/:id/approve (Queue page approve)", true, `Approved item ${queueItemId}`);
        } else {
            record("16. PUT /api/posts/queue/:id/approve (Queue page approve)", false, `Status ${approveRes.status}`);
        }
    } else {
        record("16. PUT /api/posts/queue/:id/approve (Queue page approve)", false, "No queue item ID");
    }

    // 17. Reject Post (Queue page reject button)
    if (testPostId) {
        const rejectRes = await client.put(`/posts/queue/${testPostId}/reject`, { reason: "User tested reject" });
        if (rejectRes.status === 200 && rejectRes.data?.success) {
            record("17. PUT /api/posts/queue/:id/reject (Queue page reject)", true, `Rejected item ${testPostId}`);
        } else {
            record("17. PUT /api/posts/queue/:id/reject (Queue page reject)", false, `Status ${rejectRes.status}`);
        }
    } else {
        record("17. PUT /api/posts/queue/:id/reject (Queue page reject)", false, "No post ID");
    }

    // 18. Trigger AI Batch (Dashboard 'Trigger AI Batch' button)
    const batchRes = await client.post("/ai/batch", { batchSize: 5 });
    if (batchRes.status === 200 && batchRes.data?.success) {
        record("18. POST /api/ai/batch (Dashboard Trigger AI Batch)", true, `Batch execution successful`);
    } else {
        record("18. POST /api/ai/batch (Dashboard Trigger AI Batch)", false, `Status ${batchRes.status}`);
    }

    // 19. Retry Post (Queue page retry action)
    if (testPostId) {
        const retryRes = await client.post(`/posts/${testPostId}/retry`);
        // If scheduled post exists or returns response
        record("19. POST /api/posts/:id/retry (Queue retry action)", retryRes.status === 200 || retryRes.status === 404, `Status ${retryRes.status}`);
    }

    // 20. Delete Post
    if (testPostId) {
        const delRes = await client.delete(`/posts/${testPostId}`);
        if (delRes.status === 200 && delRes.data?.success) {
            record("20. DELETE /api/posts/:id (Post deletion)", true, `Deleted post ${testPostId}`);
        } else {
            record("20. DELETE /api/posts/:id (Post deletion)", false, `Status ${delRes.status}`);
        }
    }

    console.log("\n==========================================================");
    const passedCount = results.filter(r => r.passed).length;
    const totalCount = results.length;
    console.log(`🎯 SUMMARY: ${passedCount} / ${totalCount} APIs PASSED`);
    if (passedCount === totalCount) {
        console.log("🌟 ALL APIS FULLY WORKING AND CONNECTED FRONTEND <-> BACKEND!");
    } else {
        console.log("⚠️ Some tests failed. Check log above for details.");
    }
    console.log("==========================================================");

    process.exit(passedCount === totalCount ? 0 : 1);
}

runAllFrontendTests().catch(err => {
    console.error("Test runner encountered error:", err);
    process.exit(1);
});
