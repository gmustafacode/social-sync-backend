import mongoose from "mongoose";

const linkedinAnalyticsSchema = new mongoose.Schema(
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

        postId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "LinkedInPost"
        },

        linkedinPostId: {
            type: String,
            required: true
        },

        impressions: {
            type: Number,
            default: 0
        },

        membersReached: {
            type: Number,
            default: 0
        },

        reactions: {
            type: Number,
            default: 0
        },

        comments: {
            type: Number,
            default: 0
        },

        reshares: {
            type: Number,
            default: 0
        },

        saves: {
            type: Number,
            default: 0
        },

        sends: {
            type: Number,
            default: 0
        },

        linkClicks: {
            type: Number,
            default: 0
        },

        followerGained: {
            type: Number,
            default: 0
        },

        profileViews: {
            type: Number,
            default: 0
        },

        engagementRate: {
            type: Number,
            default: 0
        },

        rawData: {
            type: mongoose.Schema.Types.Mixed
        },

        fetchedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

linkedinAnalyticsSchema.index(
    {
        socialAccountId: 1,
        linkedinPostId: 1
    },
    {
        unique: true
    }
);

const LinkedInAnalytics =
    mongoose.model(
        "LinkedInAnalytics",
        linkedinAnalyticsSchema
    );

export default LinkedInAnalytics;