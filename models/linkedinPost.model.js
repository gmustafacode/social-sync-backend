import mongoose from "mongoose";

const linkedinPostSchema = new mongoose.Schema(
    {
        userId: {
            type: String,
            required: true
        },

        socialAccountId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "SocialAccount",
            required: true
        },

        linkedinPostId: {
            type: String,
            required: true
        },

        authorUrn: {
            type: String
        },

        commentary: {
            type: String,
            default: ""
        },

        publishedAt: {
            type: Date
        },

        lastModifiedAt: {
            type: Date
        },

        lifecycleState: {
            type: String
        },

        visibility: {
            type: String
        },

        content: {
            type: mongoose.Schema.Types.Mixed
        },

        rawData: {
            type: mongoose.Schema.Types.Mixed
        }
    },
    {
        timestamps: true
    }
);

linkedinPostSchema.index(
    {
        socialAccountId: 1,
        linkedinPostId: 1
    },
    {
        unique: true
    }
);

const LinkedInPost =
    mongoose.model(
        "LinkedInPost",
        linkedinPostSchema
    );

export default LinkedInPost;