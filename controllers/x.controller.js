import axios from "axios";
import crypto from "crypto";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";

import SocialAccount from "../models/socialAccount.model.js";
import User from "../models/user.model.js";

dotenv.config();



// =====================================================
// CONFIG
// =====================================================

const CLIENT_ID = process.env.X_CLIENT_ID;
const CLIENT_SECRET = process.env.X_CLIENT_SECRET;
const CALLBACK_URL = process.env.X_CALLBACK_URL;


// =====================================================
// TEMP USER
// =====================================================

const TEMP_USER_ID = "temp-user-001";


// =====================================================
// PKCE
// =====================================================

const generateCodeVerifier = () => {

    return crypto
        .randomBytes(32)
        .toString("base64url");

};


const generateCodeChallenge = (codeVerifier) => {

    return crypto
        .createHash("sha256")
        .update(codeVerifier)
        .digest("base64url");

};


// =====================================================
// CONNECT X
// GET /api/social/x/connect
// =====================================================

export const connectX = (req, res) => {
    try {
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = generateCodeChallenge(codeVerifier);

        const state = crypto.randomBytes(16).toString("hex");

        // Store JWT token alongside PKCE state so callback can resolve the user
        req.app.locals.xOAuth = {
            codeVerifier,
            state,
            token: req.query.token || null,
        };

        const params = new URLSearchParams({
            response_type: "code",
            client_id: CLIENT_ID,
            redirect_uri: CALLBACK_URL,
            scope: "tweet.read tweet.write users.read offline.access",
            state,
            code_challenge: codeChallenge,
            code_challenge_method: "S256",
        });

        const authorizationUrl = `https://x.com/i/oauth2/authorize?${params.toString()}`;
        res.redirect(authorizationUrl);

    } catch (error) {
        console.error("X CONNECT ERROR:", error);
        res.status(500).json({ success: false, message: "Failed to connect X" });
    }
};



// =====================================================
// X CALLBACK
// GET /api/social/x/callback
// =====================================================

export const xCallback = async (
    req,
    res
) => {

    try {

        const {
            code,
            state,
            error
        } = req.query;


        if (error) {

            return res.status(400).json({

                success: false,

                message:
                    "X authorization denied",

                error

            });

        }


        if (!code) {

            return res.status(400).json({

                success: false,

                message:
                    "Authorization code missing"

            });

        }


        const oauthData =
            req.app.locals.xOAuth;


        if (!oauthData) {

            return res.status(400).json({

                success: false,

                message:
                    "OAuth session expired. Try again."

            });

        }


        if (
            state !==
            oauthData.state
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid OAuth state"

            });

        }


        // =================================================
        // EXCHANGE CODE
        // =================================================

        const tokenResponse =
            await axios.post(

                "https://api.x.com/2/oauth2/token",

                new URLSearchParams({

                    code,

                    grant_type:
                        "authorization_code",

                    client_id:
                        CLIENT_ID,

                    redirect_uri:
                        CALLBACK_URL,

                    code_verifier:
                        oauthData.codeVerifier

                }),

                {

                    headers: {

                        "Content-Type":
                            "application/x-www-form-urlencoded",

                        Authorization:
                            `Basic ${Buffer
                                .from(
                                    `${CLIENT_ID}:${CLIENT_SECRET}`
                                )
                                .toString("base64")}`

                    }

                }

            );


        const {

            access_token,
            refresh_token,
            expires_in,
            scope

        } = tokenResponse.data;


        // =================================================
        // GET X USER
        // =================================================

        const userResponse =
            await axios.get(

                "https://api.x.com/2/users/me",

                {

                    headers: {

                        Authorization:
                            `Bearer ${access_token}`

                    },

                    params: {

                        "user.fields":
                            "id,name,username,profile_image_url,description,created_at,public_metrics"

                    }

                }

            );


        const xUser = userResponse.data.data;

        // =================================================
        // RESOLVE USER ID from stored JWT token
        // =================================================

        let userId = TEMP_USER_ID;
        const storedToken = req.app.locals.xOAuth?.token;
        if (storedToken) {
            try {
                const decoded = jwt.verify(storedToken, process.env.JWT_SECRET);
                userId = decoded.id || decoded._id || decoded.userId || TEMP_USER_ID;
            } catch {
                // fallback: most recently registered user
                const latestUser = await User.findOne().sort({ createdAt: -1 }).select('_id').lean();
                if (latestUser) userId = String(latestUser._id);
            }
        }

        // =================================================
        // SAVE ACCOUNT
        // =================================================

        const socialAccount = await SocialAccount.findOneAndUpdate(
            { userId, platform: "x" },
            {
                userId,
                platform: "x",
                platformUserId: xUser.id,
                username: xUser.username,
                name: xUser.name,
                profileImage: xUser.profile_image_url,
                description: xUser.description || "",
                accessToken: access_token,
                refreshToken: refresh_token || null,
                expiresIn: expires_in || null,
                scope: scope || null,
                publicMetrics: xUser.public_metrics || {},
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        delete req.app.locals.xOAuth;

        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        return res.redirect(`${frontendUrl}/dashboard/connect?connected=x&name=${encodeURIComponent(socialAccount.name || socialAccount.username || 'X')}`);


    } catch (error) {

        console.error(
            "X CALLBACK ERROR:",
            error.response?.data ||
            error.message
        );


        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        return res.redirect(`${frontendUrl}/dashboard/connect?error=${encodeURIComponent(error.message || 'X authentication failed')}`);

    }

};


// =====================================================
// GET X ACCOUNT
// GET /api/social/x/me
// =====================================================

export const getXAccount = async (
    req,
    res
) => {

    try {

        const account =
            await SocialAccount.findOne({

                userId:
                    TEMP_USER_ID,

                platform:
                    "x"

            }).select(
                "-accessToken -refreshToken"
            );


        if (!account) {

            return res.status(404).json({

                success: false,

                message:
                    "X account not connected"

            });

        }


        res.json({

            success: true,

            account

        });


    } catch (error) {

        console.error(
            "GET X ACCOUNT ERROR:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Failed to get X account"

        });

    }

};