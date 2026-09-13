import express from "express";
import authMiddleware from "../middleware/auth.js";
import {
    generatePostContent,
    moderatePostContent,
    runAiBatch,
    getAiLogs,
    suggestAiTopics,
    refinePostContent
} from "../controllers/ai.controller.js";

const router = express.Router();

router.post("/generate", authMiddleware, generatePostContent);
router.post("/suggest-topics", authMiddleware, suggestAiTopics);
router.get("/suggest-topics", authMiddleware, suggestAiTopics);
router.post("/refine", authMiddleware, refinePostContent);
router.post("/moderate", authMiddleware, moderatePostContent);
router.post("/batch", authMiddleware, runAiBatch);
router.get("/logs", authMiddleware, getAiLogs);

export default router;
