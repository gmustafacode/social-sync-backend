import db from '../lib/db';

async function check() {
    try {
        const columns: any[] = await (db as any).$queryRawUnsafe(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'scheduled_posts'
        `);
        console.log("Columns in scheduled_posts:", columns.map((c: any) => c.column_name));
    } catch (e) {
        console.error(e);
    }
}

check().then(() => process.exit());
