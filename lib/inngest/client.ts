
import { Inngest } from "inngest";

/**
 * Inngest client for SocialSyncAra
 * 
 * In development, this naturally connects to the local dev server (default: localhost:8288).
 * In production, it uses INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY.
 */
export const inngest = new Inngest({
    id: "social-sync-ara",
});
