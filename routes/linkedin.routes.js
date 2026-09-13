import express from "express";


// =====================================================
// MAIN LINKEDIN CONTROLLER
// =====================================================

import {

    connectLinkedIn,

    linkedInCallback,

    getLinkedInProfile

} from "../controllers/linkedin.controller.js";


// =====================================================
// POST CONTROLLERS
// =====================================================

import {

    createLinkedInTextPost

} from "../controllers/linkedin/textPost.controller.js";


import {

    createLinkedInImagePost

} from "../controllers/linkedin/imagePost.controller.js";


import {

    createLinkedInVideoPost

} from "../controllers/linkedin/videoPost.controller.js";


import {
    createLinkedInDocumentPost
} from "../controllers/linkedin/documentPost.controller.js";

import {
    createLinkedInArticlePost
} from "../controllers/linkedin/articlePost.controller.js";

import {
    deleteLinkedInPost
} from "../controllers/linkedin/deletePost.controller.js";



import {

    getLinkedInFullAnalytics,

    debugLinkedInAPIs

} from "../controllers/linkedin/linkedinAnalytics.controller.js";


// =====================================================
// MULTER
// =====================================================

import multer from "multer";


const upload =
    multer({

        storage:
            multer.memoryStorage()

    });


// =====================================================
// ROUTER
// =====================================================

const router =
    express.Router();


// =====================================================
// LINKEDIN OAUTH
// =====================================================


// Connect LinkedIn

router.get(

    "/connect",

    connectLinkedIn

);


// LinkedIn Callback

router.get(

    "/callback",

    linkedInCallback

);


// =====================================================
// TEXT POST
// =====================================================

// POST
// /api/social/linkedin/post/text

router.post(
    "/post/text",
    createLinkedInTextPost
);

// =====================================================
// ARTICLE / LINK POST
// =====================================================

// POST
// /api/social/linkedin/post/article

router.post(
    "/post/article",
    createLinkedInArticlePost
);


// =====================================================
// IMAGE POST
// =====================================================

// POST
// /api/social/linkedin/post/image

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
    createLinkedInImagePost
);


// =====================================================
// VIDEO POST
// =====================================================

// POST
// /api/social/linkedin/post/video

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
    createLinkedInVideoPost
);


// =====================================================
// DOCUMENT POST
// =====================================================

// POST
// /api/social/linkedin/post/document

router.post(
    "/post/document",
    (req, res, next) => {
        upload.any()(req, res, (err) => {
            if (err) return next(err);
            if (!req.file && req.files && req.files.length > 0) {
                req.file = req.files.find((f) => f.fieldname === "document" || f.fieldname === "file") || req.files[0];
            }
            next();
        });
    },
    createLinkedInDocumentPost
);

router.get("/me", getLinkedInProfile);


// =====================================================
// DELETE POST
// =====================================================

// DELETE
// /api/social/linkedin/post/:postId

router.delete(

    "/post/:postId",

    deleteLinkedInPost

);


// =====================================================
// GET ANALYTICS
// =====================================================

// GET
// /api/social/linkedin/analytics

router.get(

    "/analytics",

    getLinkedInFullAnalytics

);


// =====================================================
// DEBUG — raw LinkedIn API responses
// GET /api/social/linkedin/debug?postUrn=urn:li:share:xxx
// =====================================================

router.get(

    "/debug",

    debugLinkedInAPIs

);

// =====================================================
// EXPORT
// =====================================================

export default router;