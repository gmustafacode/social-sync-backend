
import 'dotenv/config';
import db from '../lib/db';
import { decrypt } from '../lib/encryption';
import { refreshAccessToken } from '../lib/oauth';

// Manual mock of validateLinkedInToken since we might not be able to import it easily if it's not exported or relies on process.argv
async function validateToken(token: string) {
    try {
        const res = await fetch('https://api.linkedin.com/v2/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) return { valid: true };
        if (res.status === 403) {
            // Fallback check
            const res2 = await fetch('https://api.linkedin.com/v2/userinfo', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return { valid: res2.ok, status: res2.status };
        }
        return { valid: false, status: res.status };
    } catch (e: any) {
        return { valid: false, error: e.message };
    }
}

// Duplicate import removed

async function main() {
    console.log("🔍 Starting Backend Audit: Social Accounts & Tokens\n");

    // Use raw query to debug column mismatch (P2022)
    const accounts: any[] = await db.$queryRaw`SELECT * FROM social_accounts`;

    console.log(`Found ${accounts.length} social accounts.`);

    if (accounts.length > 0) {
        console.log("Raw Account Keys:", Object.keys(accounts[0]));
    }

    for (const account of accounts) {
        // Handle raw casing differences
        const userId = account.userId || account.user_id;
        const platform = account.platform;
        const status = account.status;
        const id = account.id;
        
        // Fetch user manually
        const user = await db.user.findUnique({ where: { id: userId } });
        const userEmail = user?.email || "Unknown";

        console.log(`\n--------------------------------------------------`);
        console.log(`👤 User: ${userEmail}`);
        console.log(`🔗 Platform: ${platform} (${status})`);
        console.log(`🆔 Account ID: ${id}`);

        // 1. Decryption Check
        let accessToken = '';
        try {
            if (account.encryptedAccessToken) {
                accessToken = decrypt(account.encryptedAccessToken);
                console.log(`✅ Token Decryption: Successful`);
            } else {
                console.warn(`⚠️  Token Decryption: No token found`);
            }
        } catch (error) {
            console.error(`❌ Token Decryption: FAILED (Corrupt data or wrong key)`);
            continue;
        }

        // 2. Expiration Check
        if (account.accessTokenExpiresAt) {
            const now = new Date();
            const expires = new Date(account.accessTokenExpiresAt);
            const timeLeft = (expires.getTime() - now.getTime()) / 1000 / 60; // minutes

            if (timeLeft < 0) {
                console.warn(`⚠️  Token Status: EXPIRED (${Math.abs(Math.round(timeLeft))} mins ago)`);

                // 3. Refresh Test
                if (account.encryptedRefreshToken) {
                    console.log(`🔄 Attempting Refresh...`);
                    try {
                        const newUrl = await refreshAccessToken(account.id);
                        if (newUrl) {
                            console.log(`✅ Refresh: SUCCESS`);
                            accessToken = newUrl; // Update for validation
                        } else {
                            console.error(`❌ Refresh: FAILED (Revoked or invalid config)`);
                        }
                    } catch (e) {
                        console.error(`❌ Refresh: ERROR`, e);
                    }
                } else {
                    console.warn(`⚠️  Refresh: No refresh token available`);
                }

            } else {
                console.log(`✅ Token Status: Active (Expires in ${Math.round(timeLeft)} mins)`);
            }
        } else {
            console.log(`ℹ️  Token Status: No expiration set (Long-lived?)`);
        }

        // 4. API Validation (LinkedIn Only for now)
        if (accessToken && account.platform === 'linkedin') {
            const validation = await validateToken(accessToken);
            console.log(`🌍 API Connectivity: ${validation.valid ? '✅ OK' : `❌ FAILED (Status: ${validation.status || validation.error})`}`);
        }
    }

    console.log(`\n--------------------------------------------------`);
    console.log("✅ Audit Complete");
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        // await db.$disconnect(); // db is shared, maybe don't disconnect? But script is ending.
    });
