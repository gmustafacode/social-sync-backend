import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;

    const scheduledPosts = await db.collection("scheduledposts").find({}).sort({ createdAt: -1 }).limit(10).toArray();
    console.log(`--- ScheduledPosts in DB (count: ${scheduledPosts.length}) ---`);
    scheduledPosts.forEach((sp, i) => {
        console.log(`${i+1}. ID: ${sp._id} | platform: ${sp.platform} | status: ${sp.status} | scheduledAt: ${sp.scheduledAt} | socialAccountId: ${sp.socialAccountId} | error: ${sp.lastError} | text: ${(sp.contentText || "").slice(0, 40)}`);
    });

    const recentPosts = await db.collection("posts").find({
        status: { $in: ["scheduled", "queued", "pending", "draft"] }
    }).sort({ createdAt: -1 }).limit(10).toArray();

    console.log(`\n--- Posts in DB with status scheduled/queued/pending (count: ${recentPosts.length}) ---`);
    recentPosts.forEach((p, i) => {
        console.log(`${i+1}. ID: ${p._id} | platforms: ${JSON.stringify(p.platforms)} | status: ${p.status} | scheduledAt: ${p.scheduledAt} | scheduledFor: ${p.scheduledFor} | text: ${(p.contentText || p.content || "").slice(0, 40)}`);
    });

    await mongoose.disconnect();
}

main().catch(console.error);
