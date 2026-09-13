import axios from "axios";

import SocialAccount from "../../models/socialAccount.model.js";

const GRAPH_API_VERSION =
    process.env.FACEBOOK_API_VERSION || "v25.0";

const GRAPH_URL =
    `https://graph.facebook.com/${GRAPH_API_VERSION}`;

const TEMP_USER_ID =
    process.env.TEMP_USER_ID || "temp-user-001";


export const debugFacebook = async (
    req,
    res
) => {

    try {

        const account =
            await SocialAccount.findOne({
                userId: TEMP_USER_ID,
                platform: "facebook"
            });


        if (!account) {

            return res.status(404).json({

                success: false,

                message:
                    "Facebook account not connected"
            });
        }


        const meResponse =
            await axios.get(
                `${GRAPH_URL}/me`,
                {
                    params: {

                        fields:
                            "id,name,picture",

                        access_token:
                            account.accessToken
                    }
                }
            );


        const pagesResponse =
            await axios.get(
                `${GRAPH_URL}/me/accounts`,
                {
                    params: {

                        fields: [
                            "id",
                            "name",
                            "category",
                            "tasks"
                        ].join(","),

                        access_token:
                            account.accessToken
                    }
                }
            );


        return res.json({

            success: true,

            apiVersion:
                GRAPH_API_VERSION,

            user:
                meResponse.data,

            pages:
                pagesResponse.data,

            tokenExists:
                Boolean(
                    account.accessToken
                )
        });


    } catch (error) {

        return res.status(
            error.response?.status || 500
        ).json({

            success: false,

            message:
                "Facebook debug failed",

            facebookError:
                error.response?.data,

            error:
                error.message
        });
    }
};