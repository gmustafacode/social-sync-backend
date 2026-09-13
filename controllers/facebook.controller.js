import axios from "axios";
import crypto from "crypto";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";

import SocialAccount from "../models/socialAccount.model.js";

dotenv.config();

const GRAPH_API_VERSION =
    process.env.FACEBOOK_API_VERSION || "v25.0";

const GRAPH_URL =
    `https://graph.facebook.com/${GRAPH_API_VERSION}`;

const TEMP_USER_ID =
    process.env.TEMP_USER_ID || "temp-user-001";


// =====================================================
// GET FACEBOOK LOGIN URL
// GET /api/social/facebook/connect
// =====================================================

export const connectFacebook = (req, res) => {

    try {

        const state = crypto
            .randomBytes(32)
            .toString("hex");

        let userId = null;
        const token = req.query?.token;
        const isMobileFlow = req.query?.mobile === "1";
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                userId = decoded?.id?.toString();
            } catch {
                return res.status(401).json({ success: false, message: "Invalid mobile session token" });
            }
        }

        req.app.locals.facebookOAuth = { state, userId };

        const redirectUri = isMobileFlow
            ? (process.env.FACEBOOK_MOBILE_REDIRECT_URI || process.env.FACEBOOK_REDIRECT_URI)
            : process.env.FACEBOOK_REDIRECT_URI;

        req.app.locals.facebookOAuth.redirectUri = redirectUri;

        const params = new URLSearchParams({

            client_id:
                process.env.FACEBOOK_APP_ID,

            redirect_uri: redirectUri,

            state,

            scope: [
                "pages_show_list",
                "pages_read_engagement",
                "pages_read_user_content",
                "pages_manage_posts",
                "pages_manage_engagement",
                "pages_manage_metadata",
                "publish_video",
                "read_insights",
                "business_management"
            ].join(",")

        });

        const authUrl =
            `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`;

        console.log("Facebook OAuth URL:");

        console.log(authUrl);

        return res.redirect(authUrl);

    } catch (error) {

        console.error(
            "Facebook Connect Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Facebook connect failed",
            error: error.message
        });
    }
};


// =====================================================
// FACEBOOK CALLBACK
// GET /api/social/facebook/callback
// =====================================================

export const facebookCallback = async (req, res) => {

    try {

        const {
            code,
            state,
            error,
            error_description
        } = req.query;


        if (error) {

            return res.status(400).json({
                success: false,
                message: "Facebook authorization denied",
                error,
                error_description
            });
        }


        if (!code) {

            return res.status(400).json({
                success: false,
                message: "Authorization code missing"
            });
        }


        const savedOAuth =
            req.app.locals.facebookOAuth;


        if (
            savedOAuth?.state &&
            savedOAuth.state !== state
        ) {

            return res.status(400).json({
                success: false,
                message: "Invalid OAuth state"
            });
        }


        // =================================================
        // EXCHANGE CODE FOR USER ACCESS TOKEN
        // =================================================

        const tokenResponse =
            await axios.get(
                `${GRAPH_URL}/oauth/access_token`,
                {
                    params: {

                        client_id:
                            process.env.FACEBOOK_APP_ID,

                        client_secret:
                            process.env.FACEBOOK_APP_SECRET,

                        redirect_uri: savedOAuth?.redirectUri || process.env.FACEBOOK_REDIRECT_URI,

                        code
                    }
                }
            );


        const userAccessToken =
            tokenResponse.data.access_token;


        console.log(
            "Facebook User Access Token received"
        );


        // =================================================
        // GET USER
        // =================================================

        const userResponse =
            await axios.get(
                `${GRAPH_URL}/me`,
                {
                    params: {
                        fields:
                            "id,name,picture",
                        access_token:
                            userAccessToken
                    }
                }
            );


        const facebookUser =
            userResponse.data;


        // =================================================
        // GET PAGES + PAGE ACCESS TOKENS
        // =================================================

        const pagesResponse =
            await axios.get(
                `${GRAPH_URL}/me/accounts`,
                {
                    params: {

                        fields: [
                            "id",
                            "name",
                            "access_token",
                            "category",
                            "tasks",
                            "picture"
                        ].join(","),

                        access_token:
                            userAccessToken
                    }
                }
            );


        const pages =
            pagesResponse.data?.data || [];


        console.log(
            "Facebook Pages:",
            pages
        );


        // =================================================
        // SAVE USER ACCOUNT
        // =================================================

        const savedUserId = savedOAuth?.userId || TEMP_USER_ID;

        await SocialAccount.findOneAndUpdate(

            {
                userId: savedUserId,

                platform:
                    "facebook"
            },

            {
                userId: savedUserId,

                platform:
                    "facebook",

                platformUserId:
                    facebookUser.id,

                name:
                    facebookUser.name,

                profileImage:
                    facebookUser.picture?.data?.url,

                accessToken:
                    userAccessToken,

                metadata: {

                    facebookUser,

                    pages
                }
            },

            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true
            }
        );


        delete req.app.locals.facebookOAuth;

        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        return res.redirect(`${frontendUrl}/dashboard/connect?connected=facebook&name=${encodeURIComponent(facebookUser.name || 'Facebook')}`);


    } catch (error) {

        console.error("Facebook Callback Error:", error.response?.data || error.message);
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        return res.redirect(`${frontendUrl}/dashboard/connect?error=${encodeURIComponent(error.message || 'Facebook connection failed')}`);

    }
};