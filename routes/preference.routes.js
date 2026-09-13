import express from "express";
import authMiddleware from "../middleware/auth.js";
import { getPreferences, updatePreferences } from "../controllers/preference.controller.js";

const router = express.Router();

router.get("/", authMiddleware, getPreferences);
router.put("/", authMiddleware, updatePreferences);

export default router;
