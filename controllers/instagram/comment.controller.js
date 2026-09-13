import {
    instagramGraphGet,
    instagramGraphPost,
    instagramGraphDelete,
    getInstagramError
} from "../../config/instagram.js";


// =====================================================
// GET COMMENTS
// GET /api/social/instagram/post/:mediaId/comments
// =====================================================

export const getComments = async (
    req,
    res
) => {

    try {

        const data =
            await instagramGraphGet(

                `${req.params.mediaId}/comments`,

                {

                    fields:
                        "id,text,username,timestamp,like_count,from,replies"

                }
            );


        return res.json({

            success: true,

            data

        });

    } catch (error) {

        return res.status(500).json({

            success: false,

            message:
                "Failed to get Instagram comments",

            instagramError:
                getInstagramError(error),

            error:
                error.message

        });
    }
};


// =====================================================
// CREATE COMMENT
// POST /api/social/instagram/post/:mediaId/comment
// =====================================================

export const createComment = async (
    req,
    res
) => {

    try {

        const {
            message
        } = req.body;


        if (!message) {

            return res.status(400).json({

                success: false,

                message:
                    "message is required"

            });
        }


        const data =
            await instagramGraphPost(

                `${req.params.mediaId}/comments`,

                {
                    message
                }

            );


        return res.json({

            success: true,

            commentId:
                data.id,

            data

        });

    } catch (error) {

        return res.status(500).json({

            success: false,

            message:
                "Instagram comment failed",

            instagramError:
                getInstagramError(error),

            error:
                error.message

        });
    }
};


// =====================================================
// REPLY COMMENT
// POST /api/social/instagram/comment/:commentId/reply
// =====================================================

export const replyToComment = async (
    req,
    res
) => {

    try {

        const {
            message
        } = req.body;


        if (!message) {

            return res.status(400).json({

                success: false,

                message:
                    "message is required"

            });
        }


        const data =
            await instagramGraphPost(

                `${req.params.commentId}/replies`,

                {
                    message
                }

            );


        return res.json({

            success: true,

            replyId:
                data.id,

            data

        });

    } catch (error) {

        return res.status(500).json({

            success: false,

            message:
                "Instagram comment reply failed",

            instagramError:
                getInstagramError(error),

            error:
                error.message

        });
    }
};


// =====================================================
// DELETE COMMENT
// DELETE /api/social/instagram/comment/:commentId
// =====================================================

export const deleteComment = async (
    req,
    res
) => {

    try {

        const data =
            await instagramGraphDelete(

                req.params.commentId

            );


        return res.json({

            success: true,

            message:
                "Instagram comment deleted",

            data

        });

    } catch (error) {

        return res.status(500).json({

            success: false,

            message:
                "Instagram comment delete failed",

            instagramError:
                getInstagramError(error),

            error:
                error.message

        });
    }
};