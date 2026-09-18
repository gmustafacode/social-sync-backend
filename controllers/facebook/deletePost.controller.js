import axios from "axios";

import SocialAccount from "../../models/socialAccount.model.js";

const GRAPH_API_VERSION =
    process.env.FACEBOOK_API_VERSION || "v25.0";

const GRAPH_URL =
    `https://graph.facebook.com/${GRAPH_API_VERSION}`;

const TEMP_USER_ID =
    process.env.TEMP_USER_ID || "temp-user-001";


export const deleteFacebookPost = async (
    req,
    res
) => {

    try {

        const {
            postId
        } = req.params;


        if (!postId) {

            return res.status(400).json({

                success: false,

                message:
                    "postId is required"
            });
        }


        const account =
            await SocialAccount.findOne({
                userId: req.userId,
                platform: "facebook"
            });


        if (!account) {

            return res.status(404).json({

                success: false,

                message:
                    "Facebook account not connected"
            });
        }


        const pages =
            account.metadata?.pages || [];


        let pageToken = null;


        for (const page of pages) {

            if (page.access_token) {

                pageToken =
                    page.access_token;

                break;
            }
        }


        if (!pageToken) {

            return res.status(404).json({

                success: false,

                message:
                    "Page Access Token not found"
            });
        }


        const response =
            await axios.delete(
                `${GRAPH_URL}/${postId}`,
                {
                    params: {

                        access_token:
                            pageToken
                    }
                }
            );


        return res.json({

            success: true,

            message:
                "Facebook post deleted",

            data:
                response.data
        });


    } catch (error) {

        return res.status(
            error.response?.status || 500
        ).json({

            success: false,

            message:
                "Facebook post delete failed",

            facebookError:
                error.response?.data,

            error:
                error.message
        });
    }
};