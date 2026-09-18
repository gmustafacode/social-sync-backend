import {
    getInstagramAccount,
    instagramGraphGet,
    getInstagramError
} from "../../config/instagram.js";


// =====================================================
// ACCOUNT ANALYTICS
// GET /api/social/instagram/analytics
// =====================================================

export const getAccountAnalytics = async (
    req,
    res
) => {

    try {

        const account =
            await getInstagramAccount(req.userId);


        const metric =
            req.query.metric ||
            "reach,profile_views";


        const period =
            req.query.period ||
            "day";


        const params = {

            metric,

            period

        };


        if (req.query.since) {

            params.since =
                req.query.since;
        }


        if (req.query.until) {

            params.until =
                req.query.until;
        }


        const data =
            await instagramGraphGet(

                `${account.platformUserId}/insights`,

                params,
                req.userId

            );


        return res.json({

            success: true,

            data

        });

    } catch (error) {

        return res.status(500).json({

            success: false,

            message:
                "Instagram account analytics failed",

            instagramError:
                getInstagramError(error),

            error:
                error.message

        });
    }
};


// =====================================================
// MEDIA ANALYTICS
// GET /api/social/instagram/analytics/media/:mediaId
// =====================================================

export const getMediaAnalytics = async (
    req,
    res
) => {

    try {

        const metric =
            req.query.metric ||
            "shares,comments,likes,saved";


        const data =
            await instagramGraphGet(

                `${req.params.mediaId}/insights`,

                {
                    metric
                },
                req.userId

            );


        return res.json({

            success: true,

            data

        });

    } catch (error) {

        return res.status(500).json({

            success: false,

            message:
                "Instagram media analytics failed",

            instagramError:
                getInstagramError(error),

            error:
                error.message

        });
    }
};