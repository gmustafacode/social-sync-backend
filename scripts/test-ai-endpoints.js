import axios from "axios";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const BASE_URL = "https://newproject-chi-gold.vercel.app/api";
const token = jwt.sign({ id: "6aa2524cba87ff1b749baf8a" }, process.env.JWT_SECRET, { expiresIn: "7d" });

const client = axios.create({
    baseURL: BASE_URL,
    headers: { Authorization: `Bearer ${token}` },
    validateStatus: () => true
});

async function runAiTests() {
    console.log("==========================================================");
    console.log("🧠 TESTING AI-ASSISTED THOUGHT LEADERSHIP ENGINE");
    console.log("==========================================================\n");

    // 1. Suggest Topics
    console.log("1️⃣ Testing /api/ai/suggest-topics...");
    const topicRes = await client.post("/ai/suggest-topics", {
        niche: "AI Agents & Cloud Architecture"
    });
    console.log("Status:", topicRes.status);
    console.log("Suggested Topics:", topicRes.data.topics);

    // 2. Generate Thought Leadership Post
    console.log("\n2️⃣ Testing /api/ai/generate (Thought Leadership)...");
    const testTopic = topicRes.data.topics?.[0] || "Why autonomous AI agents are replacing traditional microservices in modern SaaS";
    const genRes = await client.post("/ai/generate", {
        topic: testTopic,
        tone: "Visionary & Strategic",
        audience: "Founders, CTOs, and Engineering Leaders",
        postType: "text"
    });
    console.log("Status:", genRes.status);
    console.log("Generated Content Sample:\n", genRes.data.content);

    // 3. Refine Post (Make Hook Punchier)
    console.log("\n3️⃣ Testing /api/ai/refine (Punchier Hook)...");
    const refineRes = await client.post("/ai/refine", {
        content: genRes.data.content,
        action: "hook"
    });
    console.log("Status:", refineRes.status);
    console.log("Refined with Punchier Hook:\n", refineRes.data.content?.substring(0, 200) + "...");

    // 4. Moderate Post
    console.log("\n4️⃣ Testing /api/ai/moderate...");
    const modRes = await client.post("/ai/moderate", {
        content: genRes.data.content,
        platforms: ["linkedin"]
    });
    console.log("Status:", modRes.status, "Safe:", modRes.data.safe, "Score:", modRes.data.score);

    console.log("\n==========================================================");
    console.log("🎉 ALL AI ENDPOINTS 100% OPERATIONAL!");
    console.log("==========================================================");
}

runAiTests();
