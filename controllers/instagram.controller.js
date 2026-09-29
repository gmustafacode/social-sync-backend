import axios from "axios";
import crypto from "crypto";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";

import SocialAccount from "../models/socialAccount.model.js";

dotenv.config();


// =====================================================
// CONFIG
// =====================================================

const AUTH_URL =
    "https://www.instagram.com/oauth/authorize";

const SHORT_TOKEN_URL =
    "https://api.instagram.com/oauth/access_token";

const LONG_TOKEN_URL =
    "https://graph.instagram.com/access_token";

const getFrontendUrl = () => {
    const configuredUrl = process.env.FRONTEND_URL || "https://myfrontend-bice.vercel.app";
    return configuredUrl.replace(/\/+$/, "");
};


const TEMP_USER_ID =
    process.env.TEMP_USER_ID ||
    "temp-user-001";


// =====================================================
// SCOPES
// =====================================================

const INSTAGRAM_SCOPES = [
    "instagram_business_basic",
    "instagram_business_content_publish",
    "instagram_business_manage_comments",
    "instagram_business_manage_insights"
];


// =====================================================
// CONNECT
// GET /api/social/instagram/connect
// =====================================================

export const connectInstagram = async (
    req,
    res
) => {

    try {

        let userId = null;
        const token = req.query?.token;
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                userId = (decoded?.id || decoded?._id || decoded?.userId)?.toString();
            } catch {
                return res.status(401).json({ success: false, message: "Invalid session token" });
            }
        }

        const state = jwt.sign(
            {
                nonce: crypto.randomBytes(32).toString("hex"),
                userId
            },
            process.env.JWT_SECRET,
            { expiresIn: "10m" }
        );


        const params =
            new URLSearchParams({

                client_id:
                    process.env.INSTAGRAM_APP_ID,

                redirect_uri:
                    process.env.INSTAGRAM_REDIRECT_URI,

                response_type:
                    "code",

                scope:
                    INSTAGRAM_SCOPES.join(","),

                state

            });


        const authorizationUrl =
            `${AUTH_URL}?${params.toString()}`;


        return res.redirect(
            authorizationUrl
        );

    } catch (error) {

        console.error(
            "Instagram connect error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Instagram connect failed",

            error:
                error.message

        });
    }
};


// =====================================================
// CALLBACK
// GET /api/social/instagram/callback
// =====================================================

export const instagramCallback = async (
    req,
    res
) => {

    try {

        const {
            code,
            state,
            error,
            error_reason,
            error_description
        } = req.query;


        // ---------------------------------------------
        // USER DENIED
        // ---------------------------------------------

        if (error) {

            return res.status(400).json({

                success: false,

                message:
                    "Instagram authorization failed",

                error,
                error_reason,
                error_description

            });
        }


        // ---------------------------------------------
        // STATE CHECK
        // ---------------------------------------------

        let savedOAuth;
        try {
            savedOAuth = jwt.verify(state, process.env.JWT_SECRET);
        } catch {
            savedOAuth = null;
        }


        if (
            !savedOAuth ||
            typeof savedOAuth !== "object"
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid OAuth state"

            });
        }

        // ---------------------------------------------
        // CODE CHECK
        // ---------------------------------------------

        if (!code) {

            return res.status(400).json({

                success: false,

                message:
                    "Instagram authorization code missing"

            });
        }


        // ---------------------------------------------
        // EXCHANGE CODE
        // SHORT-LIVED TOKEN
        // ---------------------------------------------

        const form =
            new URLSearchParams({

                client_id:
                    process.env.INSTAGRAM_APP_ID,

                client_secret:
                    process.env.INSTAGRAM_APP_SECRET,

                grant_type:
                    "authorization_code",

                redirect_uri:
                    process.env.INSTAGRAM_REDIRECT_URI,

                code:
                    code.replace(/#_$/, "")

            });


        const shortTokenResponse =
            await axios.post(

                SHORT_TOKEN_URL,

                form.toString(),

                {
                    headers: {
                        "Content-Type":
                            "application/x-www-form-urlencoded"
                    }
                }
            );


        const shortToken =
            shortTokenResponse.data;


        if (!shortToken.access_token) {

            throw new Error(
                "Instagram short-lived access token was not returned"
            );
        }


        // ---------------------------------------------
        // EXCHANGE SHORT TOKEN
        // LONG-LIVED TOKEN
        // ---------------------------------------------

        const longTokenResponse =
            await axios.get(
                LONG_TOKEN_URL,
                {
                    params: {

                        grant_type:
                            "ig_exchange_token",

                        client_secret:
                            process.env.INSTAGRAM_APP_SECRET,

                        access_token:
                            shortToken.access_token

                    }
                }
            );


        const longToken =
            longTokenResponse.data;


        if (!longToken.access_token) {

            throw new Error(
                "Instagram long-lived access token was not returned"
            );
        }


        // ---------------------------------------------
        // GET INSTAGRAM PROFILE
        // ---------------------------------------------

        let profile;


        try {

            const profileResponse =
                await axios.get(

                    `${process.env.INSTAGRAM_API_VERSION ? `https://graph.instagram.com/${process.env.INSTAGRAM_API_VERSION}` : "https://graph.instagram.com"}/me`,

                    {
                        params: {

                            fields:
                                "id,user_id,username,name,profile_picture_url,account_type,media_count,followers_count",

                            access_token:
                                longToken.access_token

                        }
                    }
                );


            profile =
                profileResponse.data;

        } catch (profileError) {

            const fallbackResponse =
                await axios.get(

                    "https://graph.instagram.com/me",

                    {
                        params: {

                            fields:
                                "id,username",

                            access_token:
                                longToken.access_token

                        }
                    }
                );


            profile =
                fallbackResponse.data;
        }


        // ---------------------------------------------
        // INSTAGRAM USER ID
        // ---------------------------------------------

        const instagramUserId =
            profile.id ||
            profile.user_id ||
            shortToken.user_id;


        if (!instagramUserId) {

            throw new Error(
                "Instagram user ID was not returned"
            );
        }


        // ---------------------------------------------
        // EXPIRATION
        // ---------------------------------------------

        const expiresIn =
            Number(
                longToken.expires_in ||
                60 * 24 * 60 * 60
            );


        const tokenExpiresAt =
            new Date(
                Date.now() +
                expiresIn * 1000
            );


        // ---------------------------------------------
        // SAVE ACCOUNT
        // ---------------------------------------------

        const account =
            await SocialAccount.findOneAndUpdate(

                {
                    userId:
                        savedOAuth?.userId || TEMP_USER_ID,

                    platform:
                        "instagram"

                },

                {

                    userId:
                        savedOAuth?.userId || TEMP_USER_ID,

                    platform:
                        "instagram",

                    platformUserId:
                        String(instagramUserId),

                    name:
                        profile.name ||
                        null,

                    username:
                        profile.username ||
                        null,

                    profileImage:
                        profile.profile_picture_url ||
                        null,

                    accessToken:
                        longToken.access_token,

                    tokenExpiresAt,

                    metadata: {

                        accountType:
                            profile.account_type ||
                            null,

                        mediaCount:
                            profile.media_count ||
                            null,

                        followersCount:
                            profile.followers_count ||
                            null,

                        scopes:
                            INSTAGRAM_SCOPES,

                        tokenType:
                            longToken.token_type ||
                            "bearer",

                        instagramUserId:
                            String(instagramUserId)

                    }

                },

                {
                    new: true,
                    upsert: true
                }
            );


        const frontendUrl = getFrontendUrl();
        return res.redirect(`${frontendUrl}/dashboard/connect?connected=instagram&name=${encodeURIComponent(account.username || account.name || 'Instagram')}`);

    } catch (error) {
        console.error("Instagram OAuth error:", error?.response?.data || error);
        const responseData = error?.response?.data;
        const providerMessage = responseData
            ? typeof responseData === "string"
                ? responseData
                : responseData.error_message || responseData.error?.message || responseData.message
            : null;
        const message = providerMessage || error?.message || "Instagram OAuth failed";
        const frontendUrl = getFrontendUrl();
        return res.redirect(`${frontendUrl}/dashboard/connect?error=${encodeURIComponent(message)}`);
    }
};