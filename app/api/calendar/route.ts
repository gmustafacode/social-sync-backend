import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = (session.user as any).id;

        // Fetch Scheduled Posts (Universal Queue)
        const scheduledQueue = await db.scheduledPost.findMany({
            where: { userId },
            select: { id: true, platform: true, scheduledAt: true, status: true, contentText: true, publishedAt: true }
        });

        // Fetch LinkedIn Specific Posts
        const linkedInPosts = await db.linkedInPost.findMany({
            where: { userId },
            select: { id: true, scheduledAt: true, status: true, description: true }
        });

        const events: any[] = [];

        scheduledQueue.forEach(p => {
            if (p.scheduledAt || p.publishedAt) {
                events.push({
                    id: `queue-${p.id}`,
                    title: p.contentText?.substring(0, 50) + '...',
                    date: (p.scheduledAt || p.publishedAt)!.toISOString(),
                    platform: p.platform,
                    status: p.status, // pending, processing, published, failed
                    type: 'scheduled'
                });
            }
        });

        linkedInPosts.forEach(p => {
            if (p.scheduledAt) {
                events.push({
                    id: `li-${p.id}`,
                    title: p.description?.substring(0, 50) + '...',
                    date: p.scheduledAt.toISOString(),
                    platform: 'linkedin',
                    status: p.status.toLowerCase(), // DRAFT, SCHEDULED, PUBLISHED, FAILED
                    type: 'linkedin'
                });
            }
        });

        return NextResponse.json(events);

    } catch (error: any) {
        console.error("Calendar API Error:", error);
        return NextResponse.json({ error: "Failed to fetch calendar events" }, { status: 500 });
    }
}
