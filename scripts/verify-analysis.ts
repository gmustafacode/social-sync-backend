import 'dotenv/config';
import db from '../lib/db';

async function verify() {
    console.log("Verifying AI Analysis results...");

    // Check ContentAiAnalysis
    const analysis = await db.contentAiAnalysis.findFirst({
        orderBy: { createdAt: 'desc' },
        include: { content: true }
    });

    if (analysis) {
        console.log("✅ Found recent AI Analysis:");
        console.log({
            category: analysis.category,
            qualityScore: analysis.contentQualityScore,
            engagementScore: analysis.engagementScore,
            finalScore: analysis.finalScore,
            decision: analysis.content?.status,
            title: analysis.content?.title
        });
    } else {
        console.log("❌ No AI Analysis record found.");
    }

    // Check Processing Logs
    const log = await db.aiProcessingLog.findFirst({
        orderBy: { createdAt: 'desc' }
    });

    if (log) {
        console.log("\n✅ Found recent Batch Log:");
        console.log({
            processed: log.processed,
            approved: log.approved,
            aiErrors: log.aiErrors,
            finishedAt: log.finishedAt
        });
    }
}

async function main() {
    try {
        await verify();
    } catch (error) {
        console.error("Fatal error:", error);
    } finally {
        // Shared db instance
        process.exit();
    }
}

main();
