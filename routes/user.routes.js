import express from "express";
import authMiddleware from "../middleware/auth.js";
import { getUserLimits, getUserProfile } from "../controllers/user.controller.js";

const router = express.Router();

router.get("/limits", authMiddleware, getUserLimits);
router.get("/profile", authMiddleware, getUserProfile);

export default router;
