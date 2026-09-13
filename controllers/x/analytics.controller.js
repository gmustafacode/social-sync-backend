import axios from "axios";

import SocialAccount from "../../models/socialAccount.model.js";


const TEMP_USER_ID = "temp-user-001";


// =====================================================
// GET X ANALYTICS
// GET /api/social/x/analytics
// =====================================================

export const getAnalytics = async (
    req,
    res
) => {

    try {

        // =================================================
        // GET ACCOUNT
        // =================================================

        const account =
            await SocialAccount.findOne({

                userId:
                    TEMP_USER_ID,

                platform:
                    "x"

            });


        if (!account) {

            return res.status(404).json({

                success: false,

                message:
                    "X account not connected"

            });

        }


        // =================================================
        // GET CURRENT X USER
        // =================================================

        const response =
            await axios.get(

                "https://api.x.com/2/users/me",

                {

                    headers: {

                        Authorization:
                            `Bearer ${account.accessToken}`

                    },

                    params: {

                        "user.fields":
                            "id,name,username,public_metrics"

                    }

                }

            );


        const user =
            response.data.data;


        const metrics =
            user.public_metrics || {};


        // =================================================
        // RESPONSE
        // =================================================

        res.json({

            success: true,

            summary: {

                followers:
                    metrics.followers_count || 0,

                following:
                    metrics.following_count || 0,

                tweets:
                    metrics.tweet_count || 0,

                likes:
                    metrics.like_count || 0,

                listed:
                    metrics.listed_count || 0,

                media:
                    metrics.media_count || 0

            },

            account: {

                id:
                    user.id,

                name:
                    user.name,

                username:
                    user.username

            }

        });


    } catch (error) {

        console.error(
            "X ANALYTICS ERROR:",
            error.response?.data ||
            error.message
        );


        res.status(
            error.response?.status || 500
        ).json({

            success: false,

            message:
                "Failed to fetch X analytics",

            error:
                error.response?.data ||
                error.message

        });

    }

};