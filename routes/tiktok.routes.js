import express from "express";
import multer from "multer";
import authMiddleware from "../middleware/auth.js";
import { connectTikTok, tikTokCallback, getTikTokCreator, publishTikTokVideo, getTikTokPublishStatus } from "../controllers/tiktok.controller.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 }, fileFilter: (req, file, cb) => cb(null, file.mimetype?.startsWith("video/")) });

router.get("/connect", connectTikTok);
router.get("/callback", tikTokCallback);
router.use(authMiddleware);
router.get("/creator", getTikTokCreator);
router.post("/post/video", upload.single("video"), publishTikTokVideo);
router.get("/status/:publishId", getTikTokPublishStatus);

export default router;