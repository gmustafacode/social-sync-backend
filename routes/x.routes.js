import express from "express";


// OAuth / Account
import {

    connectX,
    xCallback,
    getXAccount

} from "../controllers/x.controller.js";


// Posts
import {
    createTextPost
} from "../controllers/x/textPost.controller.js";


import {
    createImagePost
} from "../controllers/x/imagePost.controller.js";


import {
    deletePost
} from "../controllers/x/deletePost.controller.js";


// Analytics
import {
    getAnalytics
} from "../controllers/x/analytics.controller.js";


// Debug
import {
    debugX
} from "../controllers/x/debug.controller.js";


const router =
    express.Router();


// =====================================================
// OAUTH
// =====================================================

router.get(
    "/connect",
    connectX
);


router.get(
    "/callback",
    xCallback
);


// =====================================================
// ACCOUNT
// =====================================================

router.get(
    "/me",
    getXAccount
);


// =====================================================
// TEXT POST
// =====================================================

router.post(
    "/post/text",
    createTextPost
);


// =====================================================
// IMAGE POST
// =====================================================

router.post(
    "/post/image",
    // multer middleware yahan add karenge
    // upload.single("image"),
    createImagePost
);


// =====================================================
// DELETE POST
// =====================================================

router.delete(
    "/post/:postId",
    deletePost
);


// =====================================================
// ANALYTICS
// =====================================================

router.get(
    "/analytics",
    getAnalytics
);


// =====================================================
// DEBUG
// =====================================================

router.get(
    "/debug",
    debugX
);


export default router;