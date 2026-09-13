import {
    getInstagramAccount,
    instagramGraphPost,
    instagramGraphGet,
    getInstagramError
} from "../../config/instagram.js";


// =====================================================
// WAIT FOR VIDEO CHILD
// =====================================================

const waitForVideoChild = async (
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
        "Carousel video child did not finish"
    );
};


// =====================================================
// CREATE CAROUSEL
// POST /api/social/instagram/post/carousel
// =====================================================

export const createCarouselPost = async (
    req,
    res
) => {

    try {

        const {
            items,
            caption = ""
        } = req.body;


        if (!Array.isArray(items)) {

            return res.status(400).json({

                success: false,

                message:
                    "items must be an array"

            });
        }


        if (
            items.length < 2 ||
            items.length > 10
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Carousel must contain 2 to 10 items"

            });
        }


        const account =
            await getInstagramAccount();


        const childContainerIds = [];


        // =================================================
        // CREATE CHILD CONTAINERS
        // =================================================

        for (
            const item of items
        ) {

            if (
                !item.type ||
                !item.url
            ) {

                throw new Error(
                    "Every carousel item needs type and url"
                );
            }


            const type =
                String(
                    item.type
                ).toUpperCase();


            let container;


            if (type === "IMAGE") {

                container =
                    await instagramGraphPost(

                        `${account.platformUserId}/media`,

                        {

                            image_url:
                                item.url,

                            is_carousel_item:
                                true

                        }
                    );

            } else if (
                type === "VIDEO"
            ) {

                container =
                    await instagramGraphPost(

                        `${account.platformUserId}/media`,

                        {

                            media_type:
                                "REELS",

                            video_url:
                                item.url,

                            is_carousel_item:
                                true

                        }
                    );


                await waitForVideoChild(
                    container.id
                );

            } else {

                throw new Error(
                    "Carousel item type must be IMAGE or VIDEO"
                );
            }


            if (!container.id) {

                throw new Error(
                    "Carousel child container ID missing"
                );
            }


            childContainerIds.push(
                container.id
            );
        }


        // =================================================
        // CREATE PARENT CAROUSEL CONTAINER
        // =================================================

        const carouselContainer =
            await instagramGraphPost(

                `${account.platformUserId}/media`,

                {

                    media_type:
                        "CAROUSEL",

                    children:
                        childContainerIds.join(","),

                    caption

                }
            );


        const carouselId =
            carouselContainer.id;


        if (!carouselId) {

            throw new Error(
                "Carousel container ID missing"
            );
        }


        // =================================================
        // PUBLISH CAROUSEL
        // =================================================

        const published =
            await instagramGraphPost(

                `${account.platformUserId}/media_publish`,

                {

                    creation_id:
                        carouselId

                }
            );


        return res.json({

            success: true,

            message:
                "Instagram carousel published successfully",

            childContainerIds,

            carouselContainerId:
                carouselId,

            mediaId:
                published.id

        });

    } catch (error) {

        console.error(
            "Instagram carousel error:",
            error?.response?.data ||
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Instagram carousel publish failed",

            instagramError:
                getInstagramError(error),

            error:
                error.message

        });
    }
};