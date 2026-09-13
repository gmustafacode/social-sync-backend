import mongoose from "mongoose";

const socialAccountSchema = new mongoose.Schema(
    {
        userId: {
            type: String,
            required: true,
            index: true
        },

        platform: {
            type: String,
            required: true,
            index: true
        },

        status: {
            type: String,
            enum: ["active", "inactive", "expired"],
            default: "active",
            index: true
        },

        platformUserId: {
            type: String,
            required: true
        },

        name: {
            type: String
        },

        username: {
            type: String
        },

        profileImage: {
            type: String
        },

        accessToken: {
            type: String
        },

        refreshToken: {
            type: String
        },

        tokenExpiresAt: {
            type: Date
        },

        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },
    {
        timestamps: true
    }
);

socialAccountSchema.index(
    {
        userId: 1,
        platform: 1
    },
    {
        unique: true
    }
);

export default mongoose.model(
    "SocialAccount",
    socialAccountSchema
);