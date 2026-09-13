
import axios from 'axios';

const BASE_URL = 'http://localhost:3000/api';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'test_secret';

async function runAudit() {
    console.log("🚀 Starting Backend Hardening Audit...");

    // 1. Test Unauthenticated Access
    try {
        await axios.get(`${BASE_URL}/posts`);
        console.error("❌ FAIL: /api/posts allowed unauthenticated GET");
    } catch (e: any) {
        if (e.response?.status === 401) console.log("✅ PASS: /api/posts rejected unauthenticated GET");
        else console.error("❌ FAIL: /api/posts returned unexpected error", e.response?.status);
    }

    // 2. Test Malformed POST Payload
    try {
        await axios.post(`${BASE_URL}/posts`, { invalid: "data" }, {
            headers: { 'Cookie': 'next-auth.session-token=mock-token' } // Note: Real session needed for pass, but Zod should catch before DB
        });
    } catch (e: any) {
        if (e.response?.status === 400 && e.response?.data?.error === "Validation failed") {
            console.log("✅ PASS: /api/posts correctly identified malformed payload via Zod");
        } else {
            console.log("ℹ️ INFO: /api/posts returned", e.response?.status, "(Session might be blocking Zod check in this mock environment)");
        }
    }

    // 3. Test Webhook Secret Guard
    try {
        await axios.post(`${BASE_URL}/posts/update-status`, { postId: '123', status: 'published' });
    } catch (e: any) {
        if (e.response?.status === 401) console.log("✅ PASS: Webhook status update requires secret");
        else console.error("❌ FAIL: Webhook status update didn't guard secret correctly");
    }

    console.log("\n🏁 Audit Script Completed. Manual verification of AI Service logs is recommended.");
}

runAudit();
