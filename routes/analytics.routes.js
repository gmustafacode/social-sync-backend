import express from "express";
import authMiddleware from "../middleware/auth.js";
import {
    getAnalyticsOverview,
    getFacebookAnalyticsData,
    getAIAnalyticsInsights,
    exportAnalyticsPDF
} from "../controllers/analytics.controller.js";

const router = express.Router();

router.get("/", authMiddleware, getAnalyticsOverview);
router.get("/overview", authMiddleware, getAnalyticsOverview);
router.get("/facebook", authMiddleware, getFacebookAnalyticsData);
router.get("/insights", authMiddleware, getAIAnalyticsInsights);
router.get("/export/pdf", authMiddleware, exportAnalyticsPDF);

export default router;
