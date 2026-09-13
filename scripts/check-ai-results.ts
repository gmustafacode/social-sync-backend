import db from '../lib/db';

async function check() {
    console.log("Fetching AI results via raw SQL...");
    try {
        const analysis = await (db as any).$queryRawUnsafe('SELECT * FROM content_ai_analysis ORDER BY created_at DESC LIMIT 1');
        console.log("ANALYSIS:", JSON.stringify(analysis, null, 2));

        const queue = await (db as any).$queryRawUnsafe('SELECT id, title, status, ai_status FROM content_queue WHERE ai_status IS NOT NULL ORDER BY analyzed_at DESC LIMIT 5');
        console.log("\nCONTENT QUEUE (AI STATUS):", JSON.stringify(queue, null, 2));

        const logs = await (db as any).$queryRawUnsafe('SELECT * FROM ai_processing_logs ORDER BY created_at DESC LIMIT 1');
        console.log("\nBATCH LOGS:", JSON.stringify(logs, null, 2));

    } catch (e) {
        console.error("SQL Error:", e);
    }
}

check().then(() => process.exit());
