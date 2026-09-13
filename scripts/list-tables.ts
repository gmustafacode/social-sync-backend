import db from '../lib/db';

async function listTables() {
    console.log("Auditing public schema tables...");
    try {
        const tables = await (db as any).$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log("TABLES:", JSON.stringify(tables, null, 2));
    } catch (e) {
        console.error("SQL Error:", e);
    }
}

listTables().then(() => process.exit());
