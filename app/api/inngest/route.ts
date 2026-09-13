import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import {
    masterOrchestrator,
    contentEngine,
    schedulerPublisher,
    analyticsEngine,
    systemUtilities
} from "@/lib/inngest/functions";

export const maxDuration = 300; // Allow functions up to 5 mins on Vercel
export const dynamic = 'force-dynamic';

export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: [
        masterOrchestrator,
        contentEngine,
        schedulerPublisher,
        analyticsEngine,
        systemUtilities
    ],
});
