import express from "express";
import authMiddleware from "../middleware/auth.js";


// OAuth
import {
    connectInstagram,
    instagramCallback
} from "../controllers/instagram.controller.js";


// Account
import {
    getAccount,
    getMedia,
    getSingleMedia
} from "../controllers/instagram/account.controller.js";


// Image
import {
    createImagePost
} from "../controllers/instagram/imagePost.controller.js";


// Video
import {
    createVideoPost
} from "../controllers/instagram/videoPost.controller.js";


// Reel
import {
    createReelPost
} from "../controllers/instagram/reel.controller.js";


// Carousel
import {
    createCarouselPost
} from "../controllers/instagram/carouselPost.controller.js";

import {
    createStory
} from "../controllers/instagram/story.controller.js";


// Container
import {
    getContainerStatus
} from "../controllers/instagram/container.controller.js";


// Delete
import {
    deleteInstagramPost
} from "../controllers/instagram/deletePost.controller.js";


// Comments
import {
    getComments,
    createComment,
    replyToComment,
    deleteComment
} from "../controllers/instagram/comment.controller.js";


// Analytics
import {
    getAccountAnalytics,
    getMediaAnalytics
} from "../controllers/instagram/analytics.controller.js";


// Token
import {
    refreshInstagramToken
} from "../controllers/instagram/token.controller.js";


// Debug
import {
    debugInstagram
} from "../controllers/instagram/debug.controller.js";


const router =
    express.Router();


// =====================================================
// OAUTH
// =====================================================

router.get(
    "/connect",
    connectInstagram
);

router.get(
    "/callback",
    instagramCallback
);

router.use(authMiddleware);


// =====================================================
// ACCOUNT
// =====================================================

router.get(
    "/account",
    getAccount
);

router.get(
    "/media",
    getMedia
);

router.get(
    "/media/:mediaId",
    getSingleMedia
);


// =====================================================
// PUBLISH
// =====================================================

router.post(
    "/post/image",
    createImagePost
);

router.post(
    "/post/video",
    createVideoPost
);

router.post(
    "/post/reel",
    createReelPost
);

router.post(
    "/post/carousel",
    createCarouselPost
);

router.post(
    "/post/story",
    createStory
);


// =====================================================
// CONTAINER
// =====================================================

router.get(
    "/container/:containerId",
    getContainerStatus
);


// =====================================================
// DELETE
// =====================================================

router.delete(
    "/post/:mediaId",
    deleteInstagramPost
);


// =====================================================
// COMMENTS
// =====================================================

router.get(
    "/post/:mediaId/comments",
    getComments
);

router.post(
    "/post/:mediaId/comment",
    createComment
);

router.post(
    "/comment/:commentId/reply",
    replyToComment
);

router.delete(
    "/comment/:commentId",
    deleteComment
);


// =====================================================
// ANALYTICS
// =====================================================

router.get(
    "/analytics",
    getAccountAnalytics
);

router.get(
    "/analytics/media/:mediaId",
    getMediaAnalytics
);


// =====================================================
// TOKEN
// =====================================================

router.post(
    "/token/refresh",
    refreshInstagramToken
);


// =====================================================
// DEBUG
// =====================================================

router.get(
    "/debug",
    debugInstagram
);


export default router;