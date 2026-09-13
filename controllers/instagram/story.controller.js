import axios from "axios";
import dotenv from "dotenv";
import SocialAccount from "../../models/socialAccount.model.js";

dotenv.config();


const TEMP_USER_ID =
    process.env.TEMP_USER_ID || "temp-user-001";


const API_VERSION =
    process.env.INSTAGRAM_API_VERSION || "v25.0";


const GRAPH_URL =
    `https://graph.instagram.com/${API_VERSION}`;


const getAccount = async () => {

    const account =
        await SocialAccount.findOne({

            userId:
                TEMP_USER_ID,

            platform:
                "instagram"

        });


    if (!account) {

        throw new Error(
            "Instagram account not connected"
        );

    }


    return account;

};


// =====================================================
// CREATE + PUBLISH STORY
// POST /post/story
// =====================================================

export const createStory =
async (req, res) => {

    try {

        const {

            mediaUrl,

            mediaType

        } = req.body;


        if (!mediaUrl) {

            return res.status(400).json({

                success: false,

                message:
                    "mediaUrl is required"

            });

        }


        if (
            !["IMAGE", "VIDEO"]
                .includes(
                    mediaType
                )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "mediaType must be IMAGE or VIDEO"

            });

        }


        const account =
            await getAccount();


        // ---------------------------------------------
        // CREATE STORY CONTAINER
        // ---------------------------------------------

        const params = {

            media_type:
                "STORIES",

            access_token:
                account.accessToken

        };


        if (
            mediaType ===
            "VIDEO"
        ) {

            params.video_url =
                mediaUrl;

        } else {

            params.image_url =
                mediaUrl;

        }


        const containerResponse =
            await axios.post(

                `${GRAPH_URL}/${account.platformUserId}/media`,

                null,

                {

                    params

                }

            );


        const containerId =
            containerResponse.data.id;


        // ---------------------------------------------
        // WAIT
        // ---------------------------------------------

        let status = null;


        for (
            let i = 0;
            i < 15;
            i++
        ) {

            await new Promise(
                resolve =>
                    setTimeout(resolve, 3000)
            );


            const statusResponse =
                await axios.get(

                    `${GRAPH_URL}/${containerId}`,

                    {

                        params: {

                            fields:
                                "id,status_code,status",

                            access_token:
                                account.accessToken

                        }

                    }

                );


            status =
                statusResponse.data;


            if (
                status.status_code ===
                "FINISHED"
            ) {

                break;

            }


            if (
                status.status_code ===
                "ERROR"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Instagram Story processing failed",

                    status

                });

            }

        }


        if (
            status?.status_code !==
            "FINISHED"
        ) {

            return res.status(408).json({

                success: false,

                message:
                    "Story is still processing",

                containerId,

                status

            });

        }


        // ---------------------------------------------
        // PUBLISH
        // ---------------------------------------------

        const publishResponse =
            await axios.post(

                `${GRAPH_URL}/${account.platformUserId}/media_publish`,

                null,

                {

                    params: {

                        creation_id:
                            containerId,

                        access_token:
                            account.accessToken

                    }

                }

            );


        res.json({

            success: true,

            message:
                "Instagram Story published successfully",

            containerId,

            mediaId:
                publishResponse.data.id

        });


    } catch (error) {

        res.status(500).json({

            success: false,

            message:
                "Instagram Story failed",

            instagramError:
                error.response?.data ||
                error.message

        });

    }

};