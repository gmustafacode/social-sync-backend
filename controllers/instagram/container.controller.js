import {
    instagramGraphGet,
    getInstagramError
} from "../../config/instagram.js";


// =====================================================
// GET CONTAINER STATUS
// GET /api/social/instagram/container/:containerId
// =====================================================

export const getContainerStatus = async (
    req,
    res
) => {

    try {

        const data =
            await instagramGraphGet(

                req.params.containerId,

                {
                    fields:
                        "id,status_code,status"
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
                "Failed to get container status",

            instagramError:
                getInstagramError(error),

            error:
                error.message

        });
    }
};