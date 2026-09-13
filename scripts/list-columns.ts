import db from '../lib/db';

async function listColumns() {
    console.log("Auditing content_queue columns...");
    try {
        const columns = await (db as any).$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_name = 'content_queue'");
        console.log("COLUMNS:", JSON.stringify(columns, null, 2));
    } catch (e) {
        console.error("SQL Error:", e);
    }
}

listColumns().then(() => process.exit());
