import express from "express";
import multer from "multer";
import authMiddleware from "../middleware/auth.js";
import {
    searchUnsplash,
    searchPexels,
    uploadMedia,
    cleanupTemporaryMedia
} from "../controllers/media.controller.js";

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 1024 * 1024 * 100 // 100MB limit for media
    }
});

// Media search endpoints
router.get("/unsplash", authMiddleware, searchUnsplash);
router.get("/pexels", authMiddleware, searchPexels);

// Temporary media upload endpoint
router.post(
    "/upload",
    authMiddleware,
    (req, res, next) => {
        upload.any()(req, res, (err) => {
            if (err) return next(err);
            if (!req.file && req.files && req.files.length > 0) {
                req.file = req.files.find((f) => f.fieldname === "file" || f.fieldname === "video" || f.fieldname === "image") || req.files[0];
            }
            next();
        });
    },
    uploadMedia
);

// Manual cleanup endpoint
router.delete("/temporary/:publicId", authMiddleware, cleanupTemporaryMedia);

export default router;
