import axios from "axios";
import jwt from "jsonwebtoken";
import SocialAccount from "../models/socialAccount.model.js";
import User from "../models/user.model.js";


// =====================================================
// TEMP USER
// =====================================================

const TEMP_USER_ID = "temp-user-001";
const DEPLOYED_API_URL = "https://newproject-chi-gold.vercel.app";
const DEPLOYED_FRONTEND_URL = "https://myfrontend-bice.vercel.app";
const linkedinRedirectUri =
    process.env.LINKEDIN_REDIRECT_URI ||
    `${DEPLOYED_API_URL}/api/social/linkedin/callback`;


// =====================================================
// CONNECT LINKEDIN
// GET /api/social/linkedin/connect
// =====================================================

export const connectLinkedIn = (req, res) => {
    try {
        const token = req.query.token || req.headers.authorization?.split(" ")[1] || "";
        const state = token;

        const params = new URLSearchParams({
            response_type: "code",
            client_id: process.env.LINKEDIN_CLIENT_ID,
            redirect_uri: linkedinRedirectUri,
            scope: "openid profile email w_member_social",
            state: state
        });

        const linkedinUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
        return res.redirect(linkedinUrl);
    } catch (error) {
        console.error("LinkedIn Connect Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to connect LinkedIn"
        });
    }
};

// =====================================================
// LINKEDIN CALLBACK
// GET /api/social/linkedin/callback
// =====================================================

export const linkedInCallback = async (req, res) => {
    const frontendUrl = process.env.FRONTEND_URL || DEPLOYED_FRONTEND_URL;
    try {
        const { code, error, error_description, state } = req.query;

        if (error) {
            console.error("LinkedIn OAuth Error:", error, error_description);
            return res.redirect(`${frontendUrl}/dashboard/connect?error=${encodeURIComponent(error_description || error)}`);
        }

        if (!code) {
            return res.redirect(`${frontendUrl}/dashboard/connect?error=Authorization+code+missing`);
        }

        const params = new URLSearchParams({
            grant_type: "authorization_code",
            code,
            client_id: process.env.LINKEDIN_CLIENT_ID,
            client_secret: process.env.LINKEDIN_CLIENT_SECRET,
            redirect_uri: linkedinRedirectUri
        });

        const tokenResponse = await axios.post(
            "https://www.linkedin.com/oauth/v2/accessToken",
            params,
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }
        );

        const { access_token, expires_in } = tokenResponse.data;

        // GET LINKEDIN PROFILE
        const userResponse = await axios.get(
            "https://api.linkedin.com/v2/userinfo",
            {
                headers: {
                    Authorization: `Bearer ${access_token}`
                }
            }
        );

        const linkedinUser = userResponse.data;
        console.log("LinkedIn User:", linkedinUser);

        // RESOLVE USER ID
        let resolvedUserId = null;
        if (state) {
            try {
                const decoded = jwt.verify(state, process.env.JWT_SECRET);
                if (decoded?.id) resolvedUserId = decoded.id;
            } catch (e) {
                if (state.length === 24) resolvedUserId = state;
            }
        }

        // Try matching by email
        if (!resolvedUserId && linkedinUser.email) {
            const matchedUser = await User.findOne({ email: linkedinUser.email });
            if (matchedUser) resolvedUserId = matchedUser._id.toString();
        }

        // Fallback: use recent user
        if (!resolvedUserId) {
            const anyUser = await User.findOne().sort({ createdAt: -1 });
            resolvedUserId = anyUser ? anyUser._id.toString() : TEMP_USER_ID;
        }

        let expiresAt = null;
        if (expires_in) {
            expiresAt = new Date(Date.now() + Number(expires_in) * 1000);
        }

        // SAVE LINKEDIN ACCOUNT
        const socialAccount = await SocialAccount.findOneAndUpdate(
            {
                platform: "linkedin",
                $or: [
                    { platformUserId: linkedinUser.sub },
                    { userId: resolvedUserId }
                ]
            },
            {
                userId: resolvedUserId,
                platform: "linkedin",
                platformUserId: linkedinUser.sub,
                accessToken: access_token,
                expiresIn: expires_in,
                expiresAt: expiresAt,
                tokenExpiresAt: expiresAt,
                name: linkedinUser.name,
                username: linkedinUser.name,
                email: linkedinUser.email,
                picture: linkedinUser.picture,
                profileImage: linkedinUser.picture,
                metadata: linkedinUser
            },
            {
                returnDocument: 'after',
                upsert: true,
                setDefaultsOnInsert: true
            }
        );

        console.log("LinkedIn Account Stored:", socialAccount._id, "for user:", resolvedUserId);

        const displayName = linkedinUser.name || "LinkedIn";
        return res.redirect(`${frontendUrl}/dashboard/connect?connected=linkedin&name=${encodeURIComponent(displayName)}`);
    } catch (error) {
        console.error("LinkedIn OAuth Error:", error.message);
        return res.redirect(`${frontendUrl}/dashboard/connect?error=${encodeURIComponent(error.response?.data?.error_description || error.message || 'LinkedIn connection failed')}`);
    }
};


// =====================================================
// GET LINKEDIN ACCOUNT
// GET /api/social/linkedin/me
// =====================================================

export const getLinkedInProfile = async (req, res) => {

    try {

        console.log(
            "========== GET LINKEDIN ACCOUNT =========="
        );


        console.log(
            "TEMP USER ID:",
            TEMP_USER_ID
        );


        const targetUserId = req.userId || TEMP_USER_ID;
        const socialAccount = await SocialAccount.findOne({
            platform: "linkedin",
            $or: [
                ...(req.userId ? [{ userId: req.userId }, { userId: req.userId.toString() }] : []),
                { userId: targetUserId },
                { userId: TEMP_USER_ID },
                { platform: "linkedin" }
            ]
        }).lean();


        // =================================================
        // ACCOUNT NOT FOUND
        // =================================================

        if (!socialAccount) {

            console.log(
                "LinkedIn account not found in DB"
            );


            return res.status(404).json({

                success: false,

                message:
                    "LinkedIn account not connected"

            });

        }


        console.log(
            "Social Account ID:",
            socialAccount._id
        );

        console.log(
            "LinkedIn User ID:",
            socialAccount.platformUserId
        );

        console.log(
            "Access Token Exists:",
            Boolean(
                socialAccount.accessToken
            )
        );


        // =================================================
        // ACCESS TOKEN CHECK
        // =================================================

        if (!socialAccount.accessToken) {

            return res.status(401).json({

                success: false,

                message:
                    "LinkedIn access token missing"

            });

        }


        // =================================================
        // CALL LINKEDIN USERINFO
        // =================================================

        const response =
            await axios.get(

                "https://api.linkedin.com/v2/userinfo",

                {

                    headers: {

                        Authorization:
                            `Bearer ${socialAccount.accessToken}`

                    }

                }

            );


        const linkedinUser =
            response.data;


        console.log(
            "LinkedIn API Response:"
        );

        console.log(
            linkedinUser
        );


        // =================================================
        // RETURN DATA
        // =================================================

        return res.json({

            success: true,

            message:
                "LinkedIn account data fetched successfully",

            account: {

                id:
                    socialAccount._id,

                platform:
                    socialAccount.platform,

                platformUserId:
                    socialAccount.platformUserId,

                name:
                    linkedinUser.name,

                given_name:
                    linkedinUser.given_name,

                family_name:
                    linkedinUser.family_name,

                email:
                    linkedinUser.email || null,

                picture:
                    linkedinUser.picture || null,

                locale:
                    linkedinUser.locale || null

            }

        });

    }

    catch (error) {

        console.error(
            "LinkedIn Get Account Error:"
        );


        console.error(
            "STATUS:",
            error.response?.status
        );


        console.error(
            "DATA:",
            error.response?.data
        );


        console.error(
            "MESSAGE:",
            error.message
        );


        // =================================================
        // TOKEN INVALID / EXPIRED
        // =================================================

        if (
            error.response?.status === 401
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "LinkedIn access token is invalid or expired",

                error:
                    error.response?.data

            });

        }


        return res.status(500).json({

            success: false,

            message:
                "Failed to fetch LinkedIn account",

            error:
                error.response?.data ||
                error.message

        });

    }

};