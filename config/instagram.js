import axios from "axios";

import SocialAccount from "../models/socialAccount.model.js";


// =====================================================
// CONFIG
// =====================================================

const getApiVersion = () => {
    return process.env.INSTAGRAM_API_VERSION || "v25.0";
};


const getGraphBaseUrl = () => {
    return `https://graph.instagram.com/${getApiVersion()}`;
};


// =====================================================
// GET STORED INSTAGRAM ACCOUNT
// =====================================================

export const getInstagramAccount = async () => {

    const userId =
        process.env.TEMP_USER_ID || "temp-user-001";


    const account =
        await SocialAccount.findOne({
            userId,
            platform: "instagram"
        });


    if (!account) {

        const error = new Error(
            "Instagram account is not connected"
        );

        error.statusCode = 404;

        throw error;
    }


    if (!account.accessToken) {

        const error = new Error(
            "Instagram access token is missing"
        );

        error.statusCode = 401;

        throw error;
    }


    return account;
};


// =====================================================
// GRAPH GET
// =====================================================

export const instagramGraphGet = async (
    endpoint,
    params = {}
) => {

    const account =
        await getInstagramAccount();


    const cleanEndpoint =
        endpoint.replace(/^\/+/, "");


    const url =
        `${getGraphBaseUrl()}/${cleanEndpoint}`;


    try {

        const response =
            await axios.get(url, {

                params: {
                    ...params,
                    access_token:
                        account.accessToken
                }

            });


        return response.data;

    } catch (error) {

        throw error;
    }
};


// =====================================================
// GRAPH POST
// =====================================================

export const instagramGraphPost = async (
    endpoint,
    body = {}
) => {

    const account =
        await getInstagramAccount();


    const cleanEndpoint =
        endpoint.replace(/^\/+/, "");


    const url =
        `${getGraphBaseUrl()}/${cleanEndpoint}`;


    const formData =
        new URLSearchParams();


    Object.entries(body).forEach(
        ([key, value]) => {

            if (
                value !== undefined &&
                value !== null
            ) {

                formData.append(
                    key,
                    String(value)
                );
            }
        }
    );


    formData.append(
        "access_token",
        account.accessToken
    );


    try {

        const response =
            await axios.post(
                url,
                formData.toString(),
                {
                    headers: {
                        "Content-Type":
                            "application/x-www-form-urlencoded"
                    }
                }
            );


        return response.data;

    } catch (error) {

        throw error;
    }
};


// =====================================================
// GRAPH DELETE
// =====================================================

export const instagramGraphDelete = async (
    endpoint
) => {

    const account =
        await getInstagramAccount();


    const cleanEndpoint =
        endpoint.replace(/^\/+/, "");


    const url =
        `${getGraphBaseUrl()}/${cleanEndpoint}`;


    const response =
        await axios.delete(url, {

            params: {
                access_token:
                    account.accessToken
            }

        });


    return response.data;
};


// =====================================================
// ERROR FORMATTER
// =====================================================

export const getInstagramError = (
    error
) => {

    return (
        error?.response?.data ||
        {
            message:
                error?.message ||
                "Unknown Instagram API error"
        }
    );
};