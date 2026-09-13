import {
    generateSocialPost,
    moderateContent,
    runIntelligenceLayer,
    processBatch,
    suggestTopics,
    refineContent
} from "../services/ai.service.js";
import AILog from "../models/aiLog.model.js";

// POST /api/ai/generate
export const generatePostContent = async (req, res) => {
    try {
        const { topic, platform = "linkedin", audience, tone, postType } = req.body;
        if (!topic) return res.status(400).json({ success: false, message: "topic is required" });

        const result = await runIntelligenceLayer(req.userId, topic, audience, tone, postType, platform);
        res.status(200).json({
            success: true,
            content: result.rawContent,
            text: result.rawContent,
            platformContent: result.platformContent,
            safety: result.safetyStatus,
            analytics: result.analytics,
            feedback: result.feedbackPrompt
        });
    } catch (err) {
        console.error("[AI Generate Error]:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/ai/suggest-topics
export const suggestAiTopics = async (req, res) => {
    try {
        const { niche = "Technology & AI", count = 5 } = req.body;
        const topics = await suggestTopics(niche, count);
        res.status(200).json({ success: true, topics });
    } catch (err) {
        console.error("[AI Suggest Topics Error]:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/ai/refine
export const refinePostContent = async (req, res) => {
    try {
        const { content, action = "hook", instruction = "" } = req.body;
        if (!content) return res.status(400).json({ success: false, message: "content is required" });

        const refined = await refineContent(content, action, instruction);
        res.status(200).json({ success: true, content: refined, text: refined });
    } catch (err) {
        console.error("[AI Refine Error]:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/ai/moderate
export const moderatePostContent = async (req, res) => {
    try {
        const { content, platforms } = req.body;
        if (!content) return res.status(400).json({ success: false, message: "content is required" });
        const result = await moderateContent(content, platforms);
        const isSafe = result.isSafe ?? result.safe ?? true;
        res.status(200).json({
            success: true,
            safe: isSafe,
            isSafe: isSafe,
            flags: result.flags || [],
            score: result.score ?? 95,
            optimizedText: result.optimizedText || content,
            ...result
        });
    } catch (err) {
        console.error("[AI Moderate Error]:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/ai/batch
export const runAiBatch = async (req, res) => {
    try {
        const { batchSize = 10 } = req.body;
        const stats = await processBatch(batchSize);
        res.status(200).json({ success: true, stats });
    } catch (err) {
        console.error("[AI Batch Error]:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/ai/logs
export const getAiLogs = async (req, res) => {
    try {
        const logs = await AILog.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(50).lean();
        res.status(200).json({ success: true, logs });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
