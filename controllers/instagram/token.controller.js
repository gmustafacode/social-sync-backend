import axios from "axios";

import {
    getInstagramAccount,
    getInstagramError
} from "../../config/instagram.js";

import SocialAccount from "../../models/socialAccount.model.js";


// =====================================================
// REFRESH LONG-LIVED TOKEN
// POST /api/social/instagram/token/refresh
// =====================================================

export const refreshInstagramToken = async (
    req,
    res
) => {

    try {

        const account =
            await getInstagramAccount(req.userId);


        const response =
            await axios.get(

                "https://graph.instagram.com/refresh_access_token",

                {
                    params: {

                        grant_type:
                            "ig_refresh_token",

                        access_token:
                            account.accessToken

                    }
                }

            );


        const data =
            response.data;


        const expiresIn =
            Number(
                data.expires_in ||
                60 * 24 * 60 * 60
            );


        const tokenExpiresAt =
            new Date(

                Date.now() +
                expiresIn * 1000

            );


        account.accessToken =
            data.access_token;


        account.tokenExpiresAt =
            tokenExpiresAt;


        await account.save();


        return res.json({

            success: true,

            message:
                "Instagram token refreshed successfully",

            tokenExpiresAt

        });

    } catch (error) {

        return res.status(500).json({

            success: false,

            message:
                "Instagram token refresh failed",

            instagramError:
                getInstagramError(error),

            error:
                error.message

        });
    }
};