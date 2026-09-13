import express from "express";
import authMiddleware from "../middleware/auth.js";
import { getConnectedAccounts, disconnectAccount } from "../controllers/social.controller.js";

const router = express.Router();

router.get("/accounts", authMiddleware, getConnectedAccounts);
router.delete("/accounts/:id", authMiddleware, disconnectAccount);

export default router;
