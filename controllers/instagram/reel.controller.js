import {
    getInstagramAccount,
    instagramGraphPost,
    instagramGraphGet,
    getInstagramError
} from "../../config/instagram.js";


// =====================================================
// WAIT FOR REEL
// =====================================================

const waitForReel = async (
    containerId
) => {

    for (
        let attempt = 1;
        attempt <= 5;
        attempt++
    ) {

        const status =
            await instagramGraphGet(

                containerId,

                {
                    fields:
                        "id,status_code,status"
                }
            );


        console.log(
            `Reel container attempt ${attempt}:`,
            status
        );


        if (
            status.status_code ===
            "FINISHED"
        ) {

            return status;
        }


        if (
            status.status_code === "ERROR" ||
            status.status_code === "EXPIRED"
        ) {

            throw new Error(
                status.status ||
                status.status_code
            );
        }


        if (
            attempt < 5
        ) {

            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        60 * 1000
                    )
            );
        }
    }


    throw new Error(
        "Reel container did not finish within 5 minutes"
    );
};


// =====================================================
// CREATE REEL
// POST /api/social/instagram/post/reel
// =====================================================

export const createReelPost = async (
    req,
    res
) => {

    try {

        const {
            videoUrl,
            caption = "",
            shareToFeed = true
        } = req.body;


        if (!videoUrl) {

            return res.status(400).json({

                success: false,

                message:
                    "videoUrl is required"

            });
        }


        const account =
            await getInstagramAccount();


        // =================================================
        // STEP 1 — CREATE CONTAINER
        // =================================================

        const container =
            await instagramGraphPost(

                `${account.platformUserId}/media`,

                {

                    media_type:
                        "REELS",

                    video_url:
                        videoUrl,

                    caption,

                    share_to_feed:
                        shareToFeed

                }
            );


        const containerId =
            container.id;


        if (!containerId) {

            throw new Error(
                "Reel container ID was not returned"
            );
        }


        // =================================================
        // STEP 2 — WAIT
        // =================================================

        const status =
            await waitForReel(
                containerId
            );


        // =================================================
        // STEP 3 — PUBLISH
        // =================================================

        const published =
            await instagramGraphPost(

                `${account.platformUserId}/media_publish`,

                {

                    creation_id:
                        containerId

                }
            );


        return res.json({

            success: true,

            message:
                "Instagram Reel published successfully",

            containerId,

            status,

            mediaId:
                published.id

        });

    } catch (error) {

        console.error(
            "Instagram Reel error:",
            error?.response?.data ||
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Instagram Reel publish failed",

            instagramError:
                getInstagramError(error),

            error:
                error.message

        });
    }
};