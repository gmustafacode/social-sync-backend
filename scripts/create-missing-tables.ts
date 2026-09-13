import db from '../lib/db';

async function createTables() {
    console.log("Creating missing tables via direct SQL...");

    const sql = [
        `CREATE TABLE IF NOT EXISTS "content_ai_analysis" (
            "id" TEXT NOT NULL,
            "content_id" TEXT NOT NULL,
            "category" TEXT NOT NULL,
            "content_quality_score" INTEGER NOT NULL,
            "engagement_score" INTEGER NOT NULL,
            "virality_probability" INTEGER NOT NULL,
            "final_score" DOUBLE PRECISION NOT NULL,
            "recommended_platforms" JSONB NOT NULL,
            "content_type_recommendation" TEXT NOT NULL,
            "rewrite_needed" BOOLEAN NOT NULL,
            "reasoning" TEXT NOT NULL,
            "raw_llm_response" JSONB NOT NULL,
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT "content_ai_analysis_pkey" PRIMARY KEY ("id")
        );`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "content_ai_analysis_content_id_key" ON "content_ai_analysis"("content_id");`,
        `CREATE INDEX IF NOT EXISTS "content_ai_analysis_content_id_idx" ON "content_ai_analysis"("content_id");`,

        `CREATE TABLE IF NOT EXISTS "ai_processing_logs" (
            "id" TEXT NOT NULL,
            "batch_id" TEXT NOT NULL,
            "batch_size" INTEGER NOT NULL,
            "processed" INTEGER NOT NULL,
            "approved" INTEGER NOT NULL,
            "review" INTEGER NOT NULL,
            "rejected" INTEGER NOT NULL,
            "ai_errors" INTEGER NOT NULL,
            "execution_time" INTEGER NOT NULL,
            "started_at" TIMESTAMP(3) NOT NULL,
            "finished_at" TIMESTAMP(3) NOT NULL,
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT "ai_processing_logs_pkey" PRIMARY KEY ("id")
        );`,

        // Add missing columns to content_queue if they don't exist
        `DO $$ 
        BEGIN 
            BEGIN
                ALTER TABLE "content_queue" ADD COLUMN "ai_status" TEXT;
            EXCEPTION
                WHEN duplicate_column THEN RAISE NOTICE 'column ai_status already exists in content_queue.';
            END;
            BEGIN
                ALTER TABLE "content_queue" ADD COLUMN "final_score" DOUBLE PRECISION;
            EXCEPTION
                WHEN duplicate_column THEN RAISE NOTICE 'column final_score already exists in content_queue.';
            END;
            BEGIN
                ALTER TABLE "content_queue" ADD COLUMN "decision_reason" TEXT;
            EXCEPTION
                WHEN duplicate_column THEN RAISE NOTICE 'column decision_reason already exists in content_queue.';
            END;
            BEGIN
                ALTER TABLE "content_queue" ADD COLUMN "analyzed_at" TIMESTAMP(3);
            EXCEPTION
                WHEN duplicate_column THEN RAISE NOTICE 'column analyzed_at already exists in content_queue.';
            END;
        END $$;`
    ];

    for (const query of sql) {
        try {
            await (db as any).$executeRawUnsafe(query);
            console.log("✅ Executed query successfully.");
        } catch (error) {
            console.error("❌ Query failed:", error);
        }
    }
}

createTables().then(() => process.exit());
