import {
    getInstagramAccount,
    instagramGraphGet,
    getInstagramError
} from "../../config/instagram.js";


// =====================================================
// GET ACCOUNT
// GET /api/social/instagram/account
// =====================================================

export const getAccount = async (
    req,
    res
) => {

    try {

        const account =
            await getInstagramAccount();


        const profile =
            await instagramGraphGet(
                "me",
                {
                    fields:
                        "id,user_id,username,name,profile_picture_url,account_type,media_count,followers_count"
                }
            );


        return res.json({

            success: true,

            account: {

                id:
                    profile.id ||
                    profile.user_id,

                username:
                    profile.username,

                name:
                    profile.name,

                profileImage:
                    profile.profile_picture_url,

                accountType:
                    profile.account_type,

                mediaCount:
                    profile.media_count,

                followersCount:
                    profile.followers_count,

                tokenExpiresAt:
                    account.tokenExpiresAt

            }

        });

    } catch (error) {

        console.error(
            "Instagram account error:",
            error
        );


        return res.status(
            error.statusCode || 500
        ).json({

            success: false,

            message:
                "Failed to get Instagram account",

            instagramError:
                getInstagramError(error),

            error:
                error.message

        });
    }
};


// =====================================================
// GET MEDIA
// GET /api/social/instagram/media
// =====================================================

export const getMedia = async (
    req,
    res
) => {

    try {

        const account =
            await getInstagramAccount();


        const limit =
            Math.min(
                Number(req.query.limit) || 25,
                100
            );


        const params = {

            fields:
                "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,username,like_count,comments_count",

            limit

        };


        if (req.query.after) {

            params.after =
                req.query.after;
        }


        const data =
            await instagramGraphGet(
                `${account.platformUserId}/media`,
                params
            );


        return res.json({

            success: true,

            data

        });

    } catch (error) {

        return res.status(500).json({

            success: false,

            message:
                "Failed to get Instagram media",

            instagramError:
                getInstagramError(error),

            error:
                error.message

        });
    }
};


// =====================================================
// GET SINGLE MEDIA
// GET /api/social/instagram/media/:mediaId
// =====================================================

export const getSingleMedia = async (
    req,
    res
) => {

    try {

        const data =
            await instagramGraphGet(
                req.params.mediaId,
                {
                    fields:
                        "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,username,like_count,comments_count"
                }
            );


        return res.json({

            success: true,

            data

        });

    } catch (error) {

        return res.status(500).json({

            success: false,

            message:
                "Failed to get Instagram media",

            instagramError:
                getInstagramError(error),

            error:
                error.message

        });
    }
};