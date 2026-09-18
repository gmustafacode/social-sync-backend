import {
    getInstagramAccount,
    instagramGraphGet,
    getInstagramError
} from "../../config/instagram.js";


// =====================================================
// DEBUG
// GET /api/social/instagram/debug
// =====================================================

export const debugInstagram = async (
    req,
    res
) => {

    try {

        const account =
            await getInstagramAccount(req.userId);


        const profile =
            await instagramGraphGet(
                "me",
                {
                    fields:
                        "id,user_id,username,name,account_type,media_count,followers_count"
                },
                req.userId
            );


        return res.json({

            success: true,

            profile,

            database: {

                platform:
                    account.platform,

                platformUserId:
                    account.platformUserId,

                username:
                    account.username,

                tokenExpiresAt:
                    account.tokenExpiresAt,

                metadata:
                    account.metadata

            }

        });

    } catch (error) {

        return res.status(500).json({

            success: false,

            message:
                "Instagram debug failed",

            instagramError:
                getInstagramError(error),

            error:
                error.message

        });
    }
};