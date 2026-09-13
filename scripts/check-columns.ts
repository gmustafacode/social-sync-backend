import db from '../lib/db';

async function main() {
    try {
        const result = await (db as any).$queryRawUnsafe(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'scheduled_posts'
    `);
        console.log(JSON.stringify(result, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

main();
