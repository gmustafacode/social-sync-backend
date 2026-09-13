import axios from "axios";
import FormData from "form-data";

import SocialAccount from "../../models/socialAccount.model.js";


const TEMP_USER_ID = "temp-user-001";


// =====================================================
// CREATE IMAGE POST
// POST /api/social/x/post/image
// =====================================================

export const createImagePost = async (
    req,
    res
) => {

    try {

        const {
            text = ""
        } = req.body;


        const file =
            req.file;


        // =================================================
        // CHECK FILE
        // =================================================

        if (!file) {

            return res.status(400).json({

                success: false,

                message:
                    "Image file is required"

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
        // MEDIA UPLOAD
        // =================================================

        const formData =
            new FormData();


        formData.append(
            "media",
            file.buffer,
            {

                filename:
                    file.originalname,

                contentType:
                    file.mimetype

            }

        );


        formData.append(
            "media_category",
            "tweet_image"
        );


        const uploadResponse =
            await axios.post(

                "https://upload.twitter.com/1.1/media/upload.json",

                formData,

                {

                    headers: {

                        ...formData.getHeaders(),

                        Authorization:
                            `Bearer ${account.accessToken}`

                    }

                }

            );


        const mediaId =
            uploadResponse.data.media_id_string;


        console.log(
            "X MEDIA ID:",
            mediaId
        );


        // =================================================
        // CREATE TWEET
        // =================================================

        const tweetResponse =
            await axios.post(

                "https://api.x.com/2/tweets",

                {

                    text:
                        text.trim(),

                    media: {

                        media_ids: [
                            mediaId
                        ]

                    }

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


        res.status(201).json({

            success: true,

            message:
                "X image post published successfully",

            post:
                tweetResponse.data.data,

            mediaId

        });


    } catch (error) {

        console.error(
            "X IMAGE POST ERROR:",
            error.response?.data ||
            error.message
        );


        res.status(
            error.response?.status || 500
        ).json({

            success: false,

            message:
                "Failed to publish X image post",

            error:
                error.response?.data ||
                error.message

        });

    }

};