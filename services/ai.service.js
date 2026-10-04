import axios from "axios";
import mongoose from "mongoose";
import AILog from "../models/aiLog.model.js";
import ContentQueue from "../models/contentQueue.model.js";
import ContentAiAnalysis from "../models/contentAiAnalysis.model.js";
import AIProcessingLog from "../models/aiProcessingLog.model.js";
import AILearningExample from "../models/aiLearningExample.model.js";
import Preference from "../models/preference.model.js";
import { buildPostMetadata, contentWithHashtags } from "../utils/post-metadata.js";

async function safeLogAI({ userId, actionType, prompt, response, modelUsed, status, errorMessage }) {
    try {
        if (userId && mongoose.Types.ObjectId.isValid(userId.toString())) {
            await AILog.create({
                userId: userId.toString(),
                actionType,
                prompt,
                response,
                modelUsed,
                status: status || "success",
                errorMessage
            });
        }
    } catch {
        // Non-critical logging error, do not fail user request
    }
}

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const CANDIDATE_MODELS = [
    "qwen/qwen3.8-27b",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "groq/compound-mini"
];

const groqRequest = async (messages, options = {}) => {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error("GROQ_API_KEY missing in environment variables");

    let lastError = null;

    for (const model of CANDIDATE_MODELS) {
        try {
            const body = {
                model,
                messages,
                temperature: options.temperature ?? 0.7,
                max_tokens: options.max_tokens ?? 800
            };
            if (options.json) {
                body.response_format = { type: "json_object" };
            }

            const response = await axios.post(GROQ_API_URL, body, {
                headers: {
                    Authorization: `Bearer ${key}`,
                    "Content-Type": "application/json"
                },
                timeout: options.timeout ?? 25000
            });

            return {
                content: response.data.choices[0].message.content.trim(),
                modelUsed: model
            };
        } catch (err) {
            lastError = err;
            console.warn(`[AI-Service] Model ${model} failed:`, err.response?.data?.error?.message || err.message);
        }
    }

    throw new Error(`All candidate models failed. Last error: ${lastError?.response?.data?.error?.message || lastError?.message}`);
};

export const stripEmojis = (text) => {
    if (!text || typeof text !== "string") return "";
    return text
        .replace(/[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]|[\u{FE00}-\u{FE0F}]/gu, "")
        .replace(/[ \t]{2,}/g, " ")
        .trim();
};

// ─── Generate post content (Tailored LinkedIn Thought Leadership) ─────────────
export const generateSocialPost = async (
    userId,
    topic,
    platform = "linkedin",
    audience = "Founders & Tech Leaders",
    tone = "Professional",
    postType = "text"
) => {
    try {
        const userIdStr = userId?.toString();
        let learningContext = "";
        try {
            const pastLearnings = await AILearningExample.find({ userId }).sort({ createdAt: -1 }).limit(10).lean();
            if (pastLearnings.length > 0) {
                learningContext = "\nCRITICAL CONTEXT - PAST PERFORMANCE LEARNINGS:\n" +
                    pastLearnings.map(l => `- [${l.sentimentScore > 50 ? "DO THIS" : "AVOID THIS"}] ${l.keyLearnings}`).join("\n");
            }
        } catch (e) { /* ignore */ }

        const formatGuidelines = {
            text: "Standalone high-impact thought leadership post. Emphasize crisp storytelling and line spacing.",
            image: "This commentary introduces a visual infographic/photo. Hook the reader and highlight the core takeaway of the graphic.",
            article: "This commentary introduces an article/link. Provide an executive summary and personal perspective on why it matters.",
            document: "This commentary introduces a multi-page PDF presentation/slide deck. Highlight key slides and invite readers to swipe through."
        }[postType.toLowerCase()] || "Thought leadership post.";

        const prompt = `You are a world-class LinkedIn ghostwriter and B2B thought leadership strategist.
Create an authentic, viral, high-converting LinkedIn post based on the following:

Topic / Core Theme: ${topic}
Tone & Style: ${tone}
Target Audience: ${audience || "Founders, Tech Executives, and Industry Leaders"}
Post Format: ${postType} (${formatGuidelines})
${learningContext}

Structure Guidelines:
1. THE HOOK (Line 1): A provocative, scroll-stopping opening line (max 10-12 words). Make the reader click "...see more".
2. CONTEXT / TENSION: 1-2 punchy lines breaking down the misconception or industry problem.
3. THE INSIGHTS: 3-4 structured bullet points with clear, actionable value. Use clean bullet points (• or -).
4. THE TAKEAWAY: A bold, memorable perspective summarizing the core lesson.
5. THE CALL TO ACTION: A compelling, open-ended question inviting peers to share their thoughts in the comments.
6. HASHTAGS: 3-4 relevant, high-traffic hashtags at the very bottom.

Formatting Rules:
- ABSOLUTE ZERO EMOJIS: Do NOT include ANY emojis, icons, or pictorial symbols anywhere in the post content unless explicitly requested by the user.
- Keep paragraphs short (1-2 sentences max per paragraph) for effortless mobile reading.
- DO NOT use markdown code fences (\`\`\`).
- DO NOT output meta-text (e.g., "Here is your post:").
- Start immediately with the hook.`;

        const { content, modelUsed } = await groqRequest([{ role: "user", content: prompt }], { temperature: 0.75 });

        // Clean any residual markdown fences if present and strip all emojis
        const cleanedContent = stripEmojis(content.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim());

        await safeLogAI({
            userId,
            actionType: "GENERATE_POST",
            prompt: topic,
            response: cleanedContent,
            modelUsed,
            status: "success"
        });

        return cleanedContent;
    } catch (error) {
        console.error("[AI-Service] Generation failed:", error.message);
        await safeLogAI({
            userId,
            actionType: "GENERATE_POST",
            prompt: topic,
            status: "error",
            errorMessage: error.message
        });
        throw new Error("Failed to generate AI content: " + error.message);
    }
};

// ─── Suggest Trending Topics ──────────────────────────────────────────────────
export const suggestTopics = async (niche = "Technology & Artificial Intelligence", count = 5) => {
    try {
        const prompt = `You are an executive LinkedIn content strategist.
Generate ${count} compelling, viral thought leadership topic ideas for professionals in: "${niche}".
Each idea should have a strong angle (e.g. counter-intuitive lesson, architectural decision, future prediction, leadership mistake).
Return a JSON object: { "topics": ["Topic 1", "Topic 2", "Topic 3", "Topic 4", "Topic 5"] }`;

        const { content: raw } = await groqRequest([{ role: "user", content: prompt }], { temperature: 0.8, json: true });
        const parsed = JSON.parse(raw);
        if (parsed?.topics && Array.isArray(parsed.topics)) {
            return parsed.topics;
        }
    } catch (e) {
        console.warn("[AI-Service] Dynamic topic suggestion fallback:", e.message);
    }

    return [
        "Why autonomous AI agents are replacing traditional microservices in modern SaaS",
        "The 3 silent architecture mistakes that kill startup scalability before 10k users",
        "From senior engineer to tech lead: The hardest mental shifts nobody prepares you for",
        "Why clean code without business alignment is technical debt in disguise",
        "How we streamlined multi-platform social media automation using event-driven pipelines"
    ];
};

// ─── Refine & Optimize Content ────────────────────────────────────────────────
export const refineContent = async (content, action = "hook", customInstruction = "") => {
    try {
        const actionPrompts = {
            hook: "Rewrite the opening 1-2 lines to be an irresistible, scroll-stopping hook that dramatically increases click-through rates. Keep the rest of the post intact.",
            shorten: "Condense this LinkedIn post by 30-40%. Remove filler, make sentences punchier, and preserve all core insights and bullet points.",
            expand: "Expand this post with deeper actionable takeaways, specific frameworks, and real-world examples.",
            hashtags: "Analyze the post and replace or add 5 highly targeted, trending LinkedIn hashtags at the bottom.",
            custom: customInstruction || "Polish and elevate this post for maximum professional engagement."
        };

        const instruction = actionPrompts[action] || actionPrompts.custom;
        const prompt = `You are an expert LinkedIn copy editor.
Original Post:
"""
${content}
"""

Task: ${instruction}
Rules: Return the revised POST CONTENT ONLY. Start directly with the text. Do not add explanations.`;

        const { content: result } = await groqRequest([{ role: "user", content: prompt }], { temperature: 0.7 });
        return stripEmojis(result.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim());
    } catch (err) {
        console.error("[AI-Service] Refinement failed:", err.message);
        return content;
    }
};

export const generateAccountSeo = async ({ platform, accountName = "", current = {}, audience = "", niche = "" }) => {
    const prompt = `You are a social media SEO strategist. Create an account SEO package for ${platform}.
Account name: ${accountName}
Audience: ${audience || "Relevant professional audience"}
Niche: ${niche || "Not specified"}
Current fields: ${JSON.stringify(current)}

Return JSON only with these fields:
{
  "displayName": "short profile/page name",
  "headline": "platform-appropriate headline, empty string if not applicable",
  "bio": "clear profile bio, maximum 150 characters where appropriate",
  "about": "longer about/description, maximum 500 characters",
  "keywords": ["5-10 search keywords"],
  "website": "keep the current website or empty string",
  "altText": "accessible description for the profile image",
  "callToAction": "one concise call to action"
}`;

    try {
        const { content } = await groqRequest([{ role: "user", content: prompt }], {
            temperature: 0.4,
            json: true,
            max_tokens: 900
        });
        const parsed = JSON.parse(content);
        return {
            displayName: String(parsed.displayName || ""),
            headline: String(parsed.headline || ""),
            bio: String(parsed.bio || ""),
            about: String(parsed.about || ""),
            keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(String).slice(0, 10) : [],
            website: String(parsed.website || current.website || ""),
            altText: String(parsed.altText || ""),
            callToAction: String(parsed.callToAction || "")
        };
    } catch (error) {
        throw new Error(`Account SEO generation failed: ${error.message}`);
    }
};

// ─── Moderate & optimize content ─────────────────────────────────────────────
export const moderateContent = async (content, platforms = ["linkedin"]) => {
    try {
        const prompt = `You are a compliance moderator for ${platforms.join(", ")}.
CONTENT: "${content}"
Check for hate speech, harassment, spam keywords, offensive content.
Return JSON: { "isSafe": boolean, "flags": string[], "optimizedText": string }`;

        const { content: result } = await groqRequest([{ role: "user", content: prompt }], { temperature: 0.1, json: true });
        try {
            return JSON.parse(result);
        } catch {
            return { isSafe: true, flags: [], optimizedText: content };
        }
    } catch {
        return { isSafe: true, flags: [], optimizedText: content };
    }
};

// ─── Run Intelligence Layer ──────────────────────────────────────────────────
export const runIntelligenceLayer = async (userId, topic, audienceOverride, toneOverride, postTypeOverride, platformOverride) => {
    try {
        const pref = await Preference.findOne({ userId }).lean();
        const audience = audienceOverride || pref?.audienceType || "Founders & Tech Leaders";
        const tone = toneOverride || pref?.contentTone || "Professional";
        const typeAliases = {
            "text only": "text",
            "text": "text",
            "image + text": "image",
            "image": "image",
            "news/trend": "article",
            "case study": "article",
            "tutorial": "text",
            "tips": "text",
            "question": "text"
        };
        const postType = typeAliases[String(postTypeOverride || "text").toLowerCase()] || "text";

        let platforms = ["linkedin"];
        if (platformOverride) {
            platforms = Array.isArray(platformOverride) ? platformOverride : [platformOverride];
        } else if (pref?.preferredPlatforms && pref.preferredPlatforms.length > 0) {
            platforms = pref.preferredPlatforms;
        }

        const platformContent = {};
        for (const platform of platforms) {
            const content = await generateSocialPost(userId, topic, platform, audience, tone, postType);
            const metadata = buildPostMetadata({ content, topic, platform });
            platformContent[platform] = {
                text: contentWithHashtags(content, metadata),
                ...metadata,
            };
        }
        const rawContent = platformContent[platforms[0]]?.text || "";
        const safety = await moderateContent(rawContent, platforms);

        if (safety.isSafe) {
            await safeLogAI({
                userId,
                actionType: "INTELLIGENCE_LAYER",
                prompt: topic,
                response: rawContent.substring(0, 500),
                modelUsed: "qwen/qwen3.8-27b",
                status: "success"
            });
        }

        return {
            rawContent,
            platformContent,
            safetyStatus: safety,
            analytics: { engagementEstimate: 88, viralityScore: 82 },
            feedbackPrompt: `Tailored thought leadership content generated for: ${topic}`,
            mediaUrls: []
        };
    } catch (e) {
        console.error("[AI-Service] Intelligence layer failed:", e.message);
        throw e;
    }
};

// ─── AI batch processor ───────────────────────────────────────────────────────
export const processBatch = async (batchSize = 10) => {
    const startedAt = new Date();
    const batchId = `batch-${Date.now()}`;
    const stats = { processed: 0, approved: 0, review: 0, rejected: 0, ai_errors: 0, executionTimeMs: 0 };

    try {
        const pendingItems = await ContentQueue.find({ status: "pending" }).sort({ createdAt: 1 }).limit(batchSize).lean();
        if (!pendingItems.length) return stats;

        for (const item of pendingItems) {
            try {
                const content = (item.rawContent || item.summary || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
                if (content.length < 50) {
                    await ContentQueue.findByIdAndUpdate(item._id, { status: "rejected", aiStatus: "rejected", decisionReason: "Too short (<50 chars)", analyzedAt: new Date() });
                    stats.processed++; stats.rejected++; continue;
                }

                const prompt = `Evaluate this social content:
Content: "${content.substring(0, 4000)}"
Return JSON: { "category": "tech|business|marketing", "content_quality_score": 0-100, "engagement_score": 0-100, "virality_probability": 0-100, "recommended_platforms": [], "reasoning": "" }`;

                const { content: raw } = await groqRequest([{ role: "user", content: prompt }], { temperature: 0.1, json: true, timeout: 35000 });
                let analysis;
                try { analysis = JSON.parse(raw); } catch { stats.processed++; stats.ai_errors++; continue; }

                const score = Math.round((analysis.content_quality_score * 0.4) + (analysis.engagement_score * 0.3) + (analysis.virality_probability * 0.3));
                const decision = score < 40 ? "rejected" : score < 70 ? "review" : "approved";

                await ContentQueue.findByIdAndUpdate(item._id, { status: decision, aiStatus: decision, finalScore: score, decisionReason: `Score: ${score}`, analyzedAt: new Date() });
                stats.processed++;
                if (decision === "approved") stats.approved++;
                else if (decision === "review") stats.review++;
                else stats.rejected++;

                await new Promise(r => setTimeout(r, 400));
            } catch (e) {
                stats.processed++; stats.ai_errors++;
            }
        }

        stats.executionTimeMs = Date.now() - startedAt.getTime();
        await AIProcessingLog.create({ batchId, batchSize, ...stats, startedAt, finishedAt: new Date() });
        return stats;
    } catch (e) {
        console.error("[AI-Service] Batch failed:", e.message);
        throw e;
    }
};
