import { Client } from 'pg';
import 'dotenv/config';

async function fix() {
    const client = new Client({
        connectionString: process.env.DIRECT_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("Connected directly to DB.");

        // Set short lock timeout to fail fast if blocked
        await client.query('SET lock_timeout = "10s"');

        const queries = [
            'CREATE TABLE IF NOT EXISTS "content_ai_analysis" (id TEXT PRIMARY KEY, content_id TEXT NOT NULL, category TEXT NOT NULL, content_quality_score INTEGER NOT NULL, engagement_score INTEGER NOT NULL, virality_probability INTEGER NOT NULL, final_score DOUBLE PRECISION NOT NULL, recommended_platforms JSONB NOT NULL, content_type_recommendation TEXT NOT NULL, rewrite_needed BOOLEAN NOT NULL, reasoning TEXT NOT NULL, raw_llm_response JSONB NOT NULL, created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);',
            'CREATE UNIQUE INDEX IF NOT EXISTS "content_ai_analysis_content_id_key" ON "content_ai_analysis"("content_id");',
            'CREATE TABLE IF NOT EXISTS "ai_processing_logs" (id TEXT PRIMARY KEY, batch_id TEXT NOT NULL, batch_size INTEGER NOT NULL, processed INTEGER NOT NULL, approved INTEGER NOT NULL, review INTEGER NOT NULL, rejected INTEGER NOT NULL, ai_errors INTEGER NOT NULL, execution_time INTEGER NOT NULL, started_at TIMESTAMP(3) NOT NULL, finished_at TIMESTAMP(3) NOT NULL, created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);',
            'ALTER TABLE "content_queue" ADD COLUMN IF NOT EXISTS "ai_status" TEXT;',
            'ALTER TABLE "content_queue" ADD COLUMN IF NOT EXISTS "final_score" DOUBLE PRECISION;',
            'ALTER TABLE "content_queue" ADD COLUMN IF NOT EXISTS "decision_reason" TEXT;',
            'ALTER TABLE "content_queue" ADD COLUMN IF NOT EXISTS "analyzed_at" TIMESTAMP(3);',
            'CREATE TABLE IF NOT EXISTS "ai_learning_examples" (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, post_id TEXT NOT NULL, content_text TEXT NOT NULL, sentiment_score INTEGER NOT NULL, category TEXT NOT NULL, key_learnings TEXT NOT NULL, created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);',
            'GRANT ALL ON TABLE "content_ai_analysis" TO anon, authenticated;',
            'GRANT ALL ON TABLE "ai_processing_logs" TO anon, authenticated;',
            'GRANT ALL ON TABLE "content_queue" TO anon, authenticated;',
            'GRANT ALL ON TABLE "ai_learning_examples" TO anon, authenticated;'
        ];

        for (const q of queries) {
            try {
                console.log(`Executing: ${q.substring(0, 50)}...`);
                await client.query(q);
                console.log("✅ Success");
            } catch (error: unknown) {
                const e = error as Error;
                console.error("❌ Failed:", e.message);
                if (e.message?.includes('timeout')) {
                    console.log("Stopping due to timeout. Locks are still present.");
                    break;
                }
            }
        }
    } catch (error: unknown) {
        const e = error as Error;
        console.error("Connection error:", e.message);
    } finally {
        await client.end();
    }
}

fix();