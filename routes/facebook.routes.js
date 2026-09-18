import express from "express";
import multer from "multer";
import authMiddleware from "../middleware/auth.js";

import {
    connectFacebook,
    facebookCallback
} from "../controllers/facebook.controller.js";

import {
    getFacebookAccount,
    getFacebookPages
} from "../controllers/facebook/account.controller.js";

import {
    createTextPost,
    getPagePosts,
    getSinglePost
} from "../controllers/facebook/post.controller.js";

import {
    createImagePost
} from "../controllers/facebook/imagePost.controller.js";

import {
    createVideoPost
} from "../controllers/facebook/videoPost.controller.js";

import {
    deleteFacebookPost
} from "../controllers/facebook/deletePost.controller.js";

import {
    getComments,
    createComment,
    deleteComment
} from "../controllers/facebook/comment.controller.js";

import {
    getFacebookAnalytics
} from "../controllers/facebook/analytics.controller.js";

import {
    debugFacebook
} from "../controllers/facebook/debug.controller.js";


const router =
    express.Router();


const upload =
    multer({
        storage:
            multer.memoryStorage(),

        limits: {

            fileSize:
                1024 * 1024 * 500
        }
    });


// =====================================================
// OAUTH
// =====================================================

router.get(
    "/connect",
    connectFacebook
);

router.get(
    "/callback",
    facebookCallback
);

router.use(authMiddleware);


// =====================================================
// ACCOUNT
// =====================================================

router.get(
    "/account",
    getFacebookAccount
);

router.get(
    "/pages",
    getFacebookPages
);

router.post(
    "/sync-pages",
    getFacebookPages
);


// =====================================================
// POSTS
// =====================================================

router.post(
    "/post/text",
    createTextPost
);

router.post(
    "/post/image",
    (req, res, next) => {
        upload.any()(req, res, (err) => {
            if (err) return next(err);
            if (!req.file && req.files && req.files.length > 0) {
                req.file = req.files.find((f) => f.fieldname === "image" || f.fieldname === "file") || req.files[0];
            }
            next();
        });
    },
    createImagePost
);

router.post(
    "/post/video",
    (req, res, next) => {
        upload.any()(req, res, (err) => {
            if (err) return next(err);
            if (!req.file && req.files && req.files.length > 0) {
                req.file = req.files.find((f) => f.fieldname === "video" || f.fieldname === "file") || req.files[0];
            }
            next();
        });
    },
    createVideoPost
);


// =====================================================
// READ POSTS
// =====================================================

router.get(
    "/posts/:pageId",
    getPagePosts
);

router.get(
    "/post/:postId",
    getSinglePost
);


// =====================================================
// DELETE POST
// =====================================================

router.delete(
    "/post/:postId",
    deleteFacebookPost
);


// =====================================================
// COMMENTS
// =====================================================

router.get(
    "/post/:postId/comments",
    getComments
);

router.post(
    "/post/:postId/comment",
    createComment
);

router.delete(
    "/comment/:commentId",
    deleteComment
);


// =====================================================
// ANALYTICS
// =====================================================

router.get(
    "/analytics/:pageId",
    getFacebookAnalytics
);


// =====================================================
// DEBUG
// =====================================================

router.get(
    "/debug",
    debugFacebook
);


export default router;