import axios from "axios";

import SocialAccount from "../../models/socialAccount.model.js";


// =====================================================
// TEMP USER
// =====================================================

const TEMP_USER_ID = "temp-user-001";


// =====================================================
// CREATE TEXT POST
// POST /api/social/x/post/text
// =====================================================

export const createTextPost = async (
    req,
    res
) => {

    try {

        const {
            text
        } = req.body;


        // =================================================
        // VALIDATION
        // =================================================

        if (!text || !text.trim()) {

            return res.status(400).json({

                success: false,

                message:
                    "Post text is required"

            });

        }


        // =================================================
        // GET ACCOUNT
        // =================================================

        const account =
            await SocialAccount.findOne({

                userId:
                    req.userId,

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
        // CREATE POST
        // =================================================

        const response =
            await axios.post(

                "https://api.x.com/2/tweets",

                {

                    text:
                        text.trim()

                },

                {

                    headers: {

                        Authorization:
                            `Bearer ${account.accessToken}`,

                        "Content-Type":
                            "application/json"

                    }

                }

            );


        console.log(
            "X POST RESPONSE:",
            response.data
        );


        res.status(201).json({

            success: true,

            message:
                "X text post published successfully",

            post:
                response.data.data

        });


    } catch (error) {

        console.log("X POST ERROR STATUS:", error.response?.status);

        console.log(
            "X POST ERROR DATA:",
            JSON.stringify(error.response?.data, null, 2)
        );

        return res.status(error.response?.status || 500).json({
            success: false,
            message: "X post failed",
            xStatus: error.response?.status,
            xError: error.response?.data
        });
    }

};