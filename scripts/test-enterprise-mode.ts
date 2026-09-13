
import { PrismaClient } from '@prisma/client';
import { decrypt } from '../lib/encryption';
import { LinkedInService } from '../lib/linkedin-service';

const prisma = new PrismaClient();

async function testEnterpriseConnect() {
    console.log("--- LinkedIn Enterprise Connect Real-Time Audit ---");

    try {
        // Use raw query to bypass Prisma Client model definitions which might be out of sync
        const accounts = await prisma.$queryRaw`SELECT * FROM social_accounts WHERE platform = 'linkedin'` as any[];

        if (accounts.length === 0) {
            console.log("No LinkedIn accounts found in database.");
            return;
        }

        for (const account of accounts) {
            console.log(`\nChecking Account: ${account.id} (Status: ${account.status})`);

            // Raw query returns DB names (snake_case)
            const encryptedClientId = account.encrypted_client_id || account.encryptedClientId;
            const encryptedClientSecret = account.encrypted_client_secret || account.encryptedClientSecret;
            const encryptedAccessToken = account.encrypted_access_token || account.encryptedAccessToken;

            const isEnterprise = !!encryptedClientId && !!encryptedClientSecret;
            console.log(`Enterprise Mode: ${isEnterprise ? "ENABLED ✅" : "DISABLED ❌"}`);

            if (isEnterprise) {
                console.log("Decrypting credentials for test...");
                try {
                    const clientId = decrypt(encryptedClientId);
                    const clientSecret = decrypt(encryptedClientSecret);
                    const accessToken = decrypt(encryptedAccessToken);

                    console.log(`Client ID (Masked): ${clientId.substring(0, 4)}...`);

                    // Try to hit LinkedIn API with this account's token
                    const liService = new LinkedInService(accessToken);
                    const me = await liService.getMe();
                    console.log(`Successfully reached LinkedIn API as: ${me.localizedFirstName} ${me.localizedLastName} (${me.id})`);
                    console.log("Real-time access test: SUCCESS ✅");
                } catch (err: any) {
                    console.error("Failed to verify Enterprise connection:", err.message);
                }
            } else {
                console.log("This account is using the standard integration.");
            }
        }
    } catch (error) {
        console.error("Audit failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

testEnterpriseConnect();
