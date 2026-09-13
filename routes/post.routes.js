import express from "express";
import authMiddleware from "../middleware/auth.js";
import {
    createPost,
    getPosts,
    getScheduledPosts,
    retryScheduledPost,
    deletePost,
    getContentQueue,
    approveContentQueue,
    rejectContentQueue,
    fetchExternalContent,
    publishPostNow
} from "../controllers/post.controller.js";

const router = express.Router();

router.post("/", authMiddleware, createPost);
router.get("/", authMiddleware, getPosts);
router.get("/scheduled", authMiddleware, getScheduledPosts);

// Queue (must be before /:id routes to avoid conflicts)
router.get("/queue", authMiddleware, getContentQueue);
router.post("/queue/fetch", authMiddleware, fetchExternalContent);

// Approve — support both POST and PUT so frontend can use either
router.post("/queue/:id/approve", authMiddleware, approveContentQueue);
router.put("/queue/:id/approve", authMiddleware, approveContentQueue);

// Reject — support both POST and PUT
router.post("/queue/:id/reject", authMiddleware, rejectContentQueue);
router.put("/queue/:id/reject", authMiddleware, rejectContentQueue);

// Post-level operations
router.post("/:id/publish", authMiddleware, publishPostNow);
router.post("/scheduled/:id/retry", authMiddleware, retryScheduledPost);
router.post("/:id/retry", authMiddleware, retryScheduledPost);
router.delete("/:id", authMiddleware, deletePost);


export default router;
