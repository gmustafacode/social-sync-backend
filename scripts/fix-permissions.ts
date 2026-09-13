import db from '../lib/db';

async function fix() {
    console.log("Fixing Supabase public schema permissions...");
    try {
        await db.$executeRawUnsafe('GRANT USAGE ON SCHEMA public TO anon, authenticated;');
        await db.$executeRawUnsafe('GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;');
        await db.$executeRawUnsafe('GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;');
        console.log("✅ Permissions updated successfully.");
    } catch (error) {
        console.error("❌ Failed to update permissions:", error);
    }
}

fix().then(() => process.exit());
