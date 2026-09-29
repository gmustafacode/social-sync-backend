import express from "express";
import authMiddleware from "../middleware/auth.js";
import { getConnectedAccounts, disconnectAccount } from "../controllers/social.controller.js";
import { listMetaCredentials, saveMetaCredential, deleteMetaCredential } from "../controllers/meta-credentials.controller.js";

const router = express.Router();

router.get("/accounts", authMiddleware, getConnectedAccounts);
router.delete("/accounts/:id", authMiddleware, disconnectAccount);
router.get("/meta/credentials", authMiddleware, listMetaCredentials);
router.post("/meta/credentials", authMiddleware, saveMetaCredential);
router.delete("/meta/credentials/:platform", authMiddleware, deleteMetaCredential);

export default router;
