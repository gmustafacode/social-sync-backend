
import { PrismaClient } from '../lib/generated/prisma';
import 'dotenv/config';

async function testConnection() {
    console.log("🚀 Starting Deep Database Connection Test...");
    console.log("--------------------------------------------------");

    const prisma = new PrismaClient({
        log: ['error', 'warn'],
    });

    try {
        // 1. Basic Reachability (Raw SQL)
        console.log("📡 Step 1: Testing raw SQL reachability (SELECT 1)...");
        const startRaw = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        const endRaw = Date.now();
        console.log(`✅ SUCCESS: Raw SQL executed in ${endRaw - startRaw}ms.`);

        // 2. Table Accessibility
        console.log("\n📁 Step 2: Checking table record counts...");
        const tables = ['user', 'socialAccount', 'scheduledPost', 'linkedInPost'];

        for (const table of tables) {
            try {
                // @ts-ignore
                const count = await prisma[table].count();
                console.log(`✅ Table '${table}': ${count} records.`);
            } catch (err: any) {
                console.error(`❌ Error accessing table '${table}':`, err.message);
            }
        }

        // 3. Write/Delete test
        console.log("\n✍️ Step 3: Testing write/delete operation...");
        const testUserEmail = `db-test-${Date.now()}@socialsync.test`;

        try {
            const testUser = await prisma.user.create({
                data: {
                    email: testUserEmail,
                    name: "DB Connection Test User",
                }
            });
            console.log(`✅ Write Success: Created temporary user with ID ${testUser.id}.`);

            await prisma.user.delete({
                where: { id: testUser.id }
            });
            console.log("✅ Delete Success: Removed temporary user.");
        } catch (err: any) {
            console.error("❌ Write/Delete test failed:", err.message);
        }

        // 4. Checking Environment
        console.log("\n🌍 Step 4: Environment Context...");
        const dbUrl = process.env.DATABASE_URL || "MISSING";
        const directUrl = process.env.DIRECT_URL || "MISSING";

        console.log(`- DATABASE_URL: ${dbUrl.substring(0, 15)}... (using ${dbUrl.includes('pooler') ? 'Supabase Pooler' : 'Direct or Other'})`);
        console.log(`- DIRECT_URL: ${directUrl ? directUrl.substring(0, 15) + '...' : 'Not Provided'}`);

    } catch (error: any) {
        console.error("\n💥 CRITICAL CONNECTION FAILURE:");
        console.error(error);

        if (error.code === 'P1001') {
            console.error("\n🔍 Diagnosis: Prisma cannot reach the database server.");
            console.error("  - Check if your IP is allow-listed in Supabase.");
            console.error("  - Check if your internet connection is stable.");
            console.error("  - Verify your DATABASE_URL password and host.");
        }
    } finally {
        await prisma.$disconnect();
        console.log("\n--------------------------------------------------");
        console.log("🏁 Test Completed.");
    }
}

testConnection();
