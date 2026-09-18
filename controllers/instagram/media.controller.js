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


// =====================================================
// HELPER
// =====================================================

const getInstagramAccount = async (userId) => {

    const account =
        await SocialAccount.findOne({

            userId,

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
// GET MEDIA
// GET /media
// =====================================================

export const getInstagramMedia =
    async (req, res) => {

        try {

            const account =
                await getInstagramAccount(req.userId);


            const response =
                await axios.get(

                    `${GRAPH_URL}/${account.platformUserId}/media`,

                    {

                        params: {

                            fields:
                                "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,username,children",

                            access_token:
                                account.accessToken

                        }

                    }

                );


            res.json({

                success: true,

                data:
                    response.data.data,

                paging:
                    response.data.paging || null

            });


        } catch (error) {

            res.status(500).json({

                success: false,

                message:
                    "Failed to get Instagram media",

                instagramError:
                    error.response?.data ||
                    error.message

            });

        }

    };


// =====================================================
// GET SINGLE MEDIA
// GET /media/:mediaId
// =====================================================

export const getSingleMedia =
    async (req, res) => {

        try {

            const account =
                await getInstagramAccount(req.userId);


            const {
                mediaId
            } = req.params;


            const response =
                await axios.get(

                    `${GRAPH_URL}/${mediaId}`,

                    {

                        params: {

                            fields:
                                "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,username,children",

                            access_token:
                                account.accessToken

                        }

                    }

                );


            res.json({

                success: true,

                media:
                    response.data

            });


        } catch (error) {

            res.status(500).json({

                success: false,

                message:
                    "Failed to get Instagram media",

                instagramError:
                    error.response?.data ||
                    error.message

            });

        }

    };


// =====================================================
// GET CONTAINER STATUS
// GET /container/:containerId/status
// =====================================================

export const getContainerStatus =
    async (req, res) => {

        try {

            const account =
                await getInstagramAccount(req.userId);


            const {
                containerId
            } = req.params;


            const response =
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


            res.json({

                success: true,

                container:
                    response.data

            });


        } catch (error) {

            res.status(500).json({

                success: false,

                message:
                    "Failed to get container status",

                instagramError:
                    error.response?.data ||
                    error.message

            });

        }

    };


// =====================================================
// CONTENT PUBLISHING LIMIT
// GET /publishing-limit
// =====================================================

export const getPublishingLimit =
    async (req, res) => {

        try {

            const account =
                await getInstagramAccount(req.userId);


            const response =
                await axios.get(

                    `${GRAPH_URL}/${account.platformUserId}/content_publishing_limit`,

                    {

                        params: {

                            access_token:
                                account.accessToken

                        }

                    }

                );


            res.json({

                success: true,

                data:
                    response.data

            });


        } catch (error) {

            res.status(500).json({

                success: false,

                message:
                    "Failed to get publishing limit",

                instagramError:
                    error.response?.data ||
                    error.message

            });

        }

    };