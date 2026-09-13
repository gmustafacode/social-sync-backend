import { getValidAccessToken } from './oauth';
import db from './db';

export class LinkedInAuthService {
    /**
     * Ensures we have a valid access token for a given social account.
     * Uses the unified OAuth refresh logic.
     */
    static async getValidToken(socialAccountId: string): Promise<string> {
        const account = await db.socialAccount.findUnique({
            where: { id: socialAccountId }
        });

        if (!account) throw new Error("Social account not found");
        if (account.platform.toLowerCase() !== 'linkedin') throw new Error("Not a LinkedIn account");

        // Use unified getter which handles proactive refresh (5 min buffer)
        const token = await getValidAccessToken(socialAccountId);

        if (!token) {
            throw new Error("Failed to obtain valid LinkedIn access token. Connection might be revoked.");
        }

        return token;
    }
}
