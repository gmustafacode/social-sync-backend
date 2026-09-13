import axios from "axios";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import FormData from "form-data";

dotenv.config();

const BASE_URL = "http://localhost:8000/api";
const token = jwt.sign({ id: "6aa2524cba87ff1b749baf8a" }, process.env.JWT_SECRET, { expiresIn: "7d" });

const client = axios.create({
    baseURL: BASE_URL,
    headers: {
        Authorization: `Bearer ${token}`
    },
    validateStatus: () => true
});

async function runVerification() {
    console.log("==========================================================");
    console.log("🎯 VERIFYING ALL TYPES OF LINKEDIN POSTING ON BACKEND");
    console.log("==========================================================\n");

    const results = {};

    // ── 1. Text Post ───────────────────────────────────────────────────────
    console.log("1️⃣ Testing LinkedIn TEXT Post...");
    const textRes = await client.post("/social/linkedin/post/text", {
        text: `🚀 [Live Verification 1/4] LinkedIn Text Post powered by SocialSync AI! Automating professional workflows. #tech #engineering #ai [${Date.now()}]`
    });
    if (textRes.status === 201 && textRes.data?.postId) {
        results.text = { passed: true, postId: textRes.data.postId };
        console.log(`✅ Text Post Published! Post ID: ${textRes.data.postId}\n`);
    } else {
        results.text = { passed: false, error: textRes.data };
        console.log(`❌ Text Post Failed:`, textRes.status, textRes.data, "\n");
    }

    // ── 2. Article / Link Post ─────────────────────────────────────────────
    console.log("2️⃣ Testing LinkedIn ARTICLE / LINK Post...");
    const articleRes = await client.post("/social/linkedin/post/article", {
        text: `🔗 [Live Verification 2/4] Exploring AI-driven multi-platform architecture and publishing pipelines. Read full research notes below. #socialmedia #fullstack [${Date.now()}]`,
        url: "https://github.com",
        title: "SocialSync: Next-Gen Social Automation",
        description: "An enterprise-grade cross-platform publishing engine with AI optimization and moderation."
    });
    if (articleRes.status === 201 && articleRes.data?.postId) {
        results.article = { passed: true, postId: articleRes.data.postId };
        console.log(`✅ Article / Link Post Published! Post ID: ${articleRes.data.postId}\n`);
    } else {
        results.article = { passed: false, error: articleRes.data };
        console.log(`❌ Article Post Failed:`, articleRes.status, articleRes.data, "\n");
    }

    // ── 3. Image Post ──────────────────────────────────────────────────────
    console.log("3️⃣ Testing LinkedIn IMAGE Post...");
    const samplePng = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64"
    );
    const form = new FormData();
    form.append("text", `🖼️ [Live Verification 3/4] Testing visual post publishing with direct media upload via SocialSync! #media #automation [${Date.now()}]`);
    form.append("image", samplePng, { filename: "verification_image.png", contentType: "image/png" });

    const imageRes = await client.post("/social/linkedin/post/image", form, {
        headers: form.getHeaders()
    });
    if (imageRes.status === 201 && imageRes.data?.postId) {
        results.image = { passed: true, postId: imageRes.data.postId, imageUrn: imageRes.data.imageUrn };
        console.log(`✅ Image Post Published! Post ID: ${imageRes.data.postId}\n`);
    } else {
        results.image = { passed: false, error: imageRes.data };
        console.log(`❌ Image Post Failed:`, imageRes.status, imageRes.data, "\n");
    }

    // ── 4. Document / PDF Post ─────────────────────────────────────────────
    console.log("4️⃣ Testing LinkedIn DOCUMENT / PDF Post...");
    const samplePdf = Buffer.from(
        "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 44 >>\nstream\nBT /F1 24 Tf 100 700 Td (SocialSync Verified) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \n0000000214 00000 n \ntrailer\n<< /Root 1 0 R /Size 5 >>\nstartxref\n308\n%%EOF\n",
        "utf-8"
    );
    const docForm = new FormData();
    docForm.append("text", `📄 [Live Verification 4/4] Multi-page document & presentation slide deck sharing on LinkedIn. #engineering #pdf [${Date.now()}]`);
    docForm.append("title", "SocialSync System Architecture");
    docForm.append("document", samplePdf, { filename: "architecture_deck.pdf", contentType: "application/pdf" });

    const docRes = await client.post("/social/linkedin/post/document", docForm, {
        headers: docForm.getHeaders()
    });
    if (docRes.status === 201 && docRes.data?.postId) {
        results.document = { passed: true, postId: docRes.data.postId, documentUrn: docRes.data.documentUrn };
        console.log(`✅ Document Post Published! Post ID: ${docRes.data.postId}\n`);
    } else {
        results.document = { passed: false, error: docRes.data };
        console.log(`❌ Document Post Failed:`, docRes.status, docRes.data, "\n");
    }

    // ── 5. Instant Publish from Queue/Post ──────────────────────────────────
    console.log("5️⃣ Testing Queue Instant Publish (/api/posts/:id/publish)...");
    const createPostRes = await client.post("/posts", {
        content: `⚡ Testing Instant Publish from Queue to LinkedIn! [${Date.now()}]`,
        platforms: ["linkedin"],
        status: "queued"
    });
    if (createPostRes.status === 201 && createPostRes.data?.post?._id) {
        const queuedId = createPostRes.data.post._id;
        const pubRes = await client.post(`/posts/${queuedId}/publish`);
        if (pubRes.status === 200 && pubRes.data?.postId) {
            results.publishNow = { passed: true, postId: pubRes.data.postId };
            console.log(`✅ Instant Publish Successful! Post ID: ${pubRes.data.postId}\n`);
        } else {
            results.publishNow = { passed: false, error: pubRes.data };
            console.log(`❌ Instant Publish Failed:`, pubRes.status, pubRes.data, "\n");
        }
    }

    console.log("==========================================================");
    console.log("📊 ALL LINKEDIN POST TYPES VERIFICATION COMPLETE");
    console.log(JSON.stringify(results, null, 2));
    console.log("==========================================================");
}

runVerification();
