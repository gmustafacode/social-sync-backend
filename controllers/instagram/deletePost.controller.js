import {
    instagramGraphDelete,
    getInstagramError
} from "../../config/instagram.js";


// =====================================================
// DELETE INSTAGRAM MEDIA
// DELETE /api/social/instagram/post/:mediaId
// =====================================================

export const deleteInstagramPost = async (
    req,
    res
) => {

    try {

        const {
            mediaId
        } = req.params;


        if (!mediaId) {

            return res.status(400).json({

                success: false,

                message:
                    "mediaId is required"

            });
        }


        const result =
            await instagramGraphDelete(
                mediaId,
                req.userId
            );


        return res.json({

            success: true,

            message:
                "Instagram media deleted",

            result

        });

    } catch (error) {

        return res.status(500).json({

            success: false,

            message:
                "Instagram media delete failed",

            instagramError:
                getInstagramError(error),

            error:
                error.message

        });
    }
};