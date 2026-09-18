import axios from "axios";

import SocialAccount from "../../models/socialAccount.model.js";

const GRAPH_API_VERSION =
    process.env.FACEBOOK_API_VERSION || "v25.0";

const GRAPH_URL =
    `https://graph.facebook.com/${GRAPH_API_VERSION}`;

const TEMP_USER_ID =
    process.env.TEMP_USER_ID || "temp-user-001";


async function getPageToken() {

    const account =
        await SocialAccount.findOne({
            userId: req.userId,
            platform: "facebook"
        });


    if (!account) {

        throw new Error(
            "Facebook account not connected"
        );
    }


    const page =
        account.metadata?.pages?.find(
            p => p.access_token
        );


    if (!page) {

        throw new Error(
            "No Page Access Token found"
        );
    }


    return page.access_token;
}


// =====================================================
// GET COMMENTS
// GET /api/social/facebook/post/:postId/comments
// =====================================================

export const getComments = async (
    req,
    res
) => {

    try {

        const {
            postId
        } = req.params;


        const accessToken =
            await getPageToken();


        const response =
            await axios.get(
                `${GRAPH_URL}/${postId}/comments`,
                {
                    params: {

                        fields: [
                            "id",
                            "message",
                            "from",
                            "created_time",
                            "like_count",
                            "comment_count"
                        ].join(","),

                        access_token:
                            accessToken
                    }
                }
            );


        return res.json({

            success: true,

            data:
                response.data
        });


    } catch (error) {

        return res.status(
            error.response?.status || 500
        ).json({

            success: false,

            message:
                "Failed to get comments",

            facebookError:
                error.response?.data,

            error:
                error.message
        });
    }
};


// =====================================================
// CREATE COMMENT
// POST /api/social/facebook/post/:postId/comment
// =====================================================

export const createComment = async (
    req,
    res
) => {

    try {

        const {
            postId
        } = req.params;


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


        const accessToken =
            await getPageToken();


        const response =
            await axios.post(
                `${GRAPH_URL}/${postId}/comments`,
                null,
                {
                    params: {

                        message,

                        access_token:
                            accessToken
                    }
                }
            );


        return res.json({

            success: true,

            message:
                "Comment created",

            data:
                response.data
        });


    } catch (error) {

        return res.status(
            error.response?.status || 500
        ).json({

            success: false,

            message:
                "Comment creation failed",

            facebookError:
                error.response?.data,

            error:
                error.message
        });
    }
};


// =====================================================
// DELETE COMMENT
// DELETE /api/social/facebook/comment/:commentId
// =====================================================

export const deleteComment = async (
    req,
    res
) => {

    try {

        const {
            commentId
        } = req.params;


        const accessToken =
            await getPageToken();


        const response =
            await axios.delete(
                `${GRAPH_URL}/${commentId}`,
                {
                    params: {

                        access_token:
                            accessToken
                    }
                }
            );


        return res.json({

            success: true,

            message:
                "Comment deleted",

            data:
                response.data
        });


    } catch (error) {

        return res.status(
            error.response?.status || 500
        ).json({

            success: false,

            message:
                "Comment deletion failed",

            facebookError:
                error.response?.data,

            error:
                error.message
        });
    }
};