import express from "express";
import { handlePostStatusWebhook } from "../controllers/webhook.controller.js";

const router = express.Router();

router.post("/post-status", handlePostStatusWebhook);
// Also support root POST /api/webhooks
router.post("/", handlePostStatusWebhook);

export default router;
