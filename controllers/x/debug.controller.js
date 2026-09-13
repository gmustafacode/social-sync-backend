import axios from "axios";

import SocialAccount from "../../models/socialAccount.model.js";


const TEMP_USER_ID = "temp-user-001";


// =====================================================
// DEBUG X API
// GET /api/social/x/debug
// =====================================================

export const debugX = async (
    req,
    res
) => {

    try {

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
        // TEST USER API
        // =================================================

        const userResponse =
            await axios.get(

                "https://api.x.com/2/users/me",

                {

                    headers: {

                        Authorization:
                            `Bearer ${account.accessToken}`

                    },

                    params: {

                        "user.fields":
                            "id,name,username,description,profile_image_url,created_at,public_metrics"

                    }

                }

            );


        res.json({

            success: true,

            message:
                "X API debug successful",

            api: {

                endpoint:
                    "/2/users/me",

                status:
                    userResponse.status

            },

            response:
                userResponse.data

        });


    } catch (error) {

        console.error(
            "X DEBUG ERROR:",
            error.response?.data ||
            error.message
        );


        res.status(
            error.response?.status || 500
        ).json({

            success: false,

            message:
                "X API debug failed",

            error:
                error.response?.data ||
                error.message

        });

    }

};