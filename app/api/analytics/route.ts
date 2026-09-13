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

        // Fetch recent post history with parsed engagement metrics
        const history = await db.postHistory.findMany({
            where: { userId },
            orderBy: { postedAt: 'desc' },
            take: 30 // Get last 30 posts
        });

        let totalViews = 0;
        let totalLikes = 0;
        let totalComments = 0;
        let totalShares = 0;

        const chartData = history.map(post => {
            let metrics = { views: 0, likes: 0, comments: 0, shares: 0 };
            if (post.engagementMetrics) {
                try {
                    metrics = typeof post.engagementMetrics === 'string'
                        ? JSON.parse(post.engagementMetrics)
                        : post.engagementMetrics;
                } catch (e) {
                    console.error("Failed to parse metrics", e);
                }
            }

            totalViews += metrics.views || 0;
            totalLikes += metrics.likes || 0;
            totalComments += metrics.comments || 0;
            totalShares += metrics.shares || 0;

            return {
                id: post.id,
                date: post.postedAt.toISOString().split('T')[0],
                platform: post.platform,
                status: post.status,
                ...metrics
            };
        }).reverse(); // Reverse for charting (oldest to newest)

        return NextResponse.json({
            totals: {
                views: totalViews,
                likes: totalLikes,
                comments: totalComments,
                shares: totalShares,
                posts: history.length
            },
            chartData,
            history
        });

    } catch (error: any) {
        console.error("Analytics Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
