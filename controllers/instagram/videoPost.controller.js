import {
    getInstagramAccount,
    instagramGraphPost,
    instagramGraphGet,
    getInstagramError
} from "../../config/instagram.js";


// =====================================================
// WAIT FOR VIDEO CONTAINER
// =====================================================

const waitForContainer = async (
    containerId
) => {

    // 5 attempts
    // 1 minute between attempts
    //
    // Meta recommends checking approximately once
    // per minute for up to 5 minutes.

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
            `Instagram container attempt ${attempt}:`,
            status
        );


        if (
            status.status_code ===
            "FINISHED"
        ) {

            return status;
        }


        if (
            status.status_code ===
                "ERROR" ||
            status.status_code ===
                "EXPIRED"
        ) {

            throw new Error(

                `Instagram container failed: ${
                    status.status || status.status_code
                }`

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
        "Instagram video container did not become FINISHED within 5 minutes"
    );
};


// =====================================================
// CREATE VIDEO POST
// POST /api/social/instagram/post/video
// =====================================================

export const createVideoPost = async (
    req,
    res
) => {

    try {

        const {
            videoUrl,
            caption = ""
        } = req.body;


        if (!videoUrl) {

            return res.status(400).json({

                success: false,

                message:
                    "videoUrl is required"

            });
        }


        if (
            !videoUrl.startsWith("http://") &&
            !videoUrl.startsWith("https://")
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "videoUrl must be a public HTTP/HTTPS URL"

            });
        }


        const account =
            await getInstagramAccount();


        // =================================================
        // STEP 1
        // CREATE VIDEO CONTAINER
        // =================================================

        const container =
            await instagramGraphPost(

                `${account.platformUserId}/media`,

                {

                    media_type:
                        "REELS",

                    video_url:
                        videoUrl,

                    caption

                }
            );


        const containerId =
            container.id;


        if (!containerId) {

            throw new Error(
                "Instagram video container ID was not returned"
            );
        }


        // =================================================
        // STEP 2
        // WAIT FOR FINISHED
        // =================================================

        const status =
            await waitForContainer(
                containerId
            );


        // =================================================
        // STEP 3
        // PUBLISH
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
                "Instagram video published successfully",

            containerId,

            status,

            mediaId:
                published.id

        });

    } catch (error) {

        console.error(
            "Instagram video post error:",
            error?.response?.data ||
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Instagram video post failed",

            instagramError:
                getInstagramError(error),

            error:
                error.message

        });
    }
};