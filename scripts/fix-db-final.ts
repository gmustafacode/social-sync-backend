import db from '../lib/db';

async function fix() {
    const queries = [
        'ALTER TABLE "content_queue" ADD COLUMN IF NOT EXISTS "ai_status" TEXT;',
        'ALTER TABLE "content_queue" ADD COLUMN IF NOT EXISTS "final_score" DOUBLE PRECISION;',
        'ALTER TABLE "content_queue" ADD COLUMN IF NOT EXISTS "decision_reason" TEXT;',
        'ALTER TABLE "content_queue" ADD COLUMN IF NOT EXISTS "analyzed_at" TIMESTAMP(3);',
        'GRANT ALL ON TABLE "content_ai_analysis" TO anon, authenticated;',
        'GRANT ALL ON TABLE "ai_processing_logs" TO anon, authenticated;',
        'GRANT ALL ON TABLE "content_queue" TO anon, authenticated;'
    ];

    for (const q of queries) {
        try {
            console.log(`Executing: ${q}`);
            await (db as any).$executeRawUnsafe(q);
            console.log("✅ Success");
        } catch (e) {
            console.error("❌ Failed:", e);
        }
    }
}

fix().then(() => process.exit());
