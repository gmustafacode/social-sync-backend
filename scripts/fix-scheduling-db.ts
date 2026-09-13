import db from '../lib/db';

async function fix() {
    console.log("Applying database fixes for scheduling (Robust Version)...");

    const queries = [
        // 1. Add missing columns to scheduled_posts
        // We use double quotes for camelCase columns in Postgres
        `DO $$ 
        BEGIN 
            BEGIN ALTER TABLE "scheduled_posts" ADD COLUMN "timezone" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END;
            BEGIN ALTER TABLE "scheduled_posts" ADD COLUMN "retry_count" INTEGER DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END;
            BEGIN ALTER TABLE "scheduled_posts" ADD COLUMN "last_error" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END;
            BEGIN ALTER TABLE "scheduled_posts" ADD COLUMN "published_at" TIMESTAMP(3); EXCEPTION WHEN duplicate_column THEN NULL; END;
            BEGIN ALTER TABLE "scheduled_posts" ADD COLUMN "content_id" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END;
            
            -- Set default for status
            ALTER TABLE "scheduled_posts" ALTER COLUMN "status" SET DEFAULT 'pending';
            
            -- Ensure scheduledAt is non-nullable (camelCase in DB)
            UPDATE "scheduled_posts" SET "scheduledAt" = NOW() WHERE "scheduledAt" IS NULL;
            ALTER TABLE "scheduled_posts" ALTER COLUMN "scheduledAt" SET NOT NULL;
        END $$;`,

        // 2. Create cron_execution_logs table
        `CREATE TABLE IF NOT EXISTS "cron_execution_logs" (
            "id" TEXT NOT NULL,
            "started_at" TIMESTAMP(3) NOT NULL,
            "finished_at" TIMESTAMP(3),
            "processed" INTEGER NOT NULL DEFAULT 0,
            "published" INTEGER NOT NULL DEFAULT 0,
            "failed" INTEGER NOT NULL DEFAULT 0,
            "execution_time_ms" INTEGER,
            "errors_count" INTEGER NOT NULL DEFAULT 0,
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT "cron_execution_logs_pkey" PRIMARY KEY ("id")
        );`,

        // 3. Add index
        `CREATE INDEX IF NOT EXISTS "scheduled_posts_status_scheduledAt_idx" ON "scheduled_posts"("status", "scheduledAt");`
    ];

    for (const sql of queries) {
        try {
            console.log(`Executing SQL: ${sql.substring(0, 100)}...`);
            await (db as any).$executeRawUnsafe(sql);
            console.log("✅ Executed SQL successfully.");
        } catch (error) {
            console.error("❌ SQL Error:", error);
        }
    }
}

fix().then(() => process.exit());
