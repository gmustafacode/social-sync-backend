import {
    getInstagramAccount,
    instagramGraphPost,
    getInstagramError
} from "../../config/instagram.js";


// =====================================================
// CREATE IMAGE POST
// POST /api/social/instagram/post/image
// =====================================================

export const createImagePost = async (
    req,
    res
) => {

    try {

        const {
            imageUrl,
            caption = ""
        } = req.body;


        if (!imageUrl) {

            return res.status(400).json({

                success: false,

                message:
                    "imageUrl is required"

            });
        }


        if (
            !imageUrl.startsWith("http://") &&
            !imageUrl.startsWith("https://")
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "imageUrl must be a public HTTP/HTTPS URL"

            });
        }


        const account =
            await getInstagramAccount();


        // =================================================
        // STEP 1
        // CREATE CONTAINER
        // =================================================

        const container =
            await instagramGraphPost(

                `${account.platformUserId}/media`,

                {

                    image_url:
                        imageUrl,

                    caption

                }
            );


        if (!container.id) {

            throw new Error(
                "Instagram image container ID was not returned"
            );
        }


        const containerId =
            container.id;


        // =================================================
        // STEP 2
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
                "Instagram image published successfully",

            containerId,

            mediaId:
                published.id

        });

    } catch (error) {

        console.error(
            "Instagram image post error:",
            error?.response?.data ||
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Instagram image post failed",

            instagramError:
                getInstagramError(error),

            error:
                error.message

        });
    }
};