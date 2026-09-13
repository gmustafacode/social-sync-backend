/**
 * MongoDB Database Adapter
 * ========================
 * Replaces Prisma with Mongoose-based implementations.
 * Provides a Prisma-like interface so existing lib/ files continue to work
 * with minimal changes.
 */

import User from "../models/user.model.js";
import SocialAccount from "../models/socialAccount.model.js";
import Post from "../models/post.model.js";
import AILog from "../models/aiLog.model.js";
import ContentQueue from "../models/contentQueue.model.js";
import Preference from "../models/preference.model.js";
import AILearningExample from "../models/aiLearningExample.model.js";
import ContentAiAnalysis from "../models/contentAiAnalysis.model.js";
import AIProcessingLog from "../models/aiProcessingLog.model.js";
import ScheduledPost from "../models/scheduledPost.model.js";
import PostHistory from "../models/postHistory.model.js";
import LinkedInPost from "../models/linkedinPost.model.js";
import LinkedInAnalytics from "../models/linkedinAnalytics.model.js";

// ─── Prisma-like query builder helper ─────────────────────────────────────────
const buildMongoFilter = (where = {}) => {
    const filter = {};
    for (const [key, val] of Object.entries(where)) {
        if (val === null || val === undefined) continue;
        if (key === "AND") { filter["$and"] = val.map(buildMongoFilter); continue; }
        if (key === "OR")  { filter["$or"]  = val.map(buildMongoFilter); continue; }
        if (key === "NOT") { filter["$nor"] = [buildMongoFilter(val)];   continue; }
        if (typeof val === "object" && !Array.isArray(val)) {
            const ops = {};
            if (val.gte  !== undefined) ops["$gte"]  = val.gte;
            if (val.lte  !== undefined) ops["$lte"]  = val.lte;
            if (val.gt   !== undefined) ops["$gt"]   = val.gt;
            if (val.lt   !== undefined) ops["$lt"]   = val.lt;
            if (val.not  !== undefined) ops["$ne"]   = val.not;
            if (val.in   !== undefined) ops["$in"]   = val.in;
            if (val.notIn !== undefined) ops["$nin"] = val.notIn;
            if (val.contains !== undefined) ops["$regex"] = val.contains;
            if (val.equals !== undefined) filter[key] = val.equals;
            else if (Object.keys(ops).length) filter[key] = ops;
            else filter[key] = val;
        } else {
            filter[key] = val;
        }
    }
    return filter;
};

const buildSort = (orderBy = {}) => {
    if (Array.isArray(orderBy)) {
        return orderBy.reduce((acc, o) => ({ ...acc, ...o }), {});
    }
    const sort = {};
    for (const [k, v] of Object.entries(orderBy)) {
        sort[k] = v === "asc" ? 1 : -1;
    }
    return sort;
};

// ─── Generic model adapter factory ────────────────────────────────────────────
const makeAdapter = (Model) => ({
    findMany: async ({ where, orderBy, take, skip, select, include } = {}) => {
        let q = Model.find(buildMongoFilter(where));
        if (orderBy) q = q.sort(buildSort(orderBy));
        if (skip)  q = q.skip(skip);
        if (take)  q = q.limit(take);
        const docs = await q.lean();
        return docs.map(d => ({ ...d, id: d._id?.toString() }));
    },
    findFirst: async ({ where, orderBy, select, include } = {}) => {
        let q = Model.findOne(buildMongoFilter(where));
        if (orderBy) q = q.sort(buildSort(orderBy));
        const doc = await q.lean();
        if (!doc) return null;
        return { ...doc, id: doc._id?.toString() };
    },
    findUnique: async ({ where, select, include } = {}) => {
        // Handle compound unique constraints like user_platform_unique
        let filter = {};
        if (where?.user_platform_unique) filter = where.user_platform_unique;
        else if (where?.platform_platformAccountId) filter = where.platform_platformAccountId;
        else filter = buildMongoFilter(where);
        const doc = await Model.findOne(filter).lean();
        if (!doc) return null;
        return { ...doc, id: doc._id?.toString() };
    },
    create: async ({ data }) => {
        const doc = await Model.create(data);
        return { ...doc.toObject(), id: doc._id.toString() };
    },
    update: async ({ where, data }) => {
        let filter = {};
        if (where?.user_platform_unique) filter = where.user_platform_unique;
        else filter = buildMongoFilter(where);
        // Handle increment operations
        const update = {};
        const incOps = {};
        for (const [k, v] of Object.entries(data)) {
            if (v && typeof v === "object" && v.increment !== undefined) {
                incOps[k] = v.increment;
            } else {
                if (!update["$set"]) update["$set"] = {};
                update["$set"][k] = v;
            }
        }
        if (Object.keys(incOps).length) update["$inc"] = incOps;
        const doc = await Model.findOneAndUpdate(filter, update, { new: true, upsert: false }).lean();
        if (!doc) return null;
        return { ...doc, id: doc._id?.toString() };
    },
    updateMany: async ({ where, data }) => {
        const filter = buildMongoFilter(where);
        const update = {};
        const incOps = {};
        for (const [k, v] of Object.entries(data)) {
            if (v && typeof v === "object" && v.increment !== undefined) {
                incOps[k] = v.increment;
            } else {
                if (!update["$set"]) update["$set"] = {};
                update["$set"][k] = v;
            }
        }
        if (Object.keys(incOps).length) update["$inc"] = incOps;
        const result = await Model.updateMany(filter, update);
        return { count: result.modifiedCount };
    },
    delete: async ({ where }) => {
        const filter = buildMongoFilter(where);
        const doc = await Model.findOneAndDelete(filter).lean();
        if (!doc) return null;
        return { ...doc, id: doc._id?.toString() };
    },
    deleteMany: async ({ where } = {}) => {
        const result = await Model.deleteMany(buildMongoFilter(where));
        return { count: result.deletedCount };
    },
    upsert: async ({ where, create, update }) => {
        let filter = {};
        if (where?.contentId) filter = { contentId: where.contentId };
        else filter = buildMongoFilter(where);
        const doc = await Model.findOneAndUpdate(
            filter,
            { $set: update, $setOnInsert: create },
            { new: true, upsert: true }
        ).lean();
        return { ...doc, id: doc._id?.toString() };
    },
    count: async ({ where } = {}) => {
        return await Model.countDocuments(buildMongoFilter(where));
    }
});

// ─── DB Adapter Object ─────────────────────────────────────────────────────────
const db = {
    user:                 makeAdapter(User),
    socialAccount:        makeAdapter(SocialAccount),
    post:                 makeAdapter(Post),
    aiLog:                makeAdapter(AILog),
    contentQueue:         makeAdapter(ContentQueue),
    preference:           makeAdapter(Preference),
    aiLearningExample:    makeAdapter(AILearningExample),
    contentAiAnalysis:    makeAdapter(ContentAiAnalysis),
    aiProcessingLog:      makeAdapter(AIProcessingLog),
    scheduledPost:        makeAdapter(ScheduledPost),
    postHistory:          makeAdapter(PostHistory),
    linkedInPost:         makeAdapter(LinkedInPost),
    linkedinAnalytics:    makeAdapter(LinkedInAnalytics),
    cronExecutionLog:     makeAdapter(AIProcessingLog), // reuse for now

    // Prisma transaction mock — runs array of promises
    $transaction: async (operations) => {
        if (Array.isArray(operations)) {
            return await Promise.all(operations);
        }
        // Callback style
        return await operations({});
    },

    // Raw query (no-op in MongoDB — return empty)
    $queryRaw: async () => []
};

export default db;
