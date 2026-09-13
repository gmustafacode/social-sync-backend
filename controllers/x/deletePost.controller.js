import axios from "axios";

import SocialAccount from "../../models/socialAccount.model.js";


const TEMP_USER_ID = "temp-user-001";


// =====================================================
// DELETE X POST
// DELETE /api/social/x/post/:postId
// =====================================================

export const deletePost = async (
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
                    "Post ID is required"

            });

        }


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
        // DELETE
        // =================================================

        const response =
            await axios.delete(

                `https://api.x.com/2/tweets/${encodeURIComponent(postId)}`,

                {

                    headers: {

                        Authorization:
                            `Bearer ${account.accessToken}`

                    }

                }

            );


        res.json({

            success: true,

            message:
                "X post deleted successfully",

            result:
                response.data.data

        });


    } catch (error) {

        console.error(
            "X DELETE POST ERROR:",
            error.response?.data ||
            error.message
        );


        res.status(
            error.response?.status || 500
        ).json({

            success: false,

            message:
                "Failed to delete X post",

            error:
                error.response?.data ||
                error.message

        });

    }

};