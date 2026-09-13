import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import { inngest } from "@/lib/inngest/client";
import { SchedulePostSchema } from "@/lib/validations/api";
import { ZodError } from "zod";
import { SchedulerService } from "@/lib/scheduler-service";

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const userId = (session.user as any).id;

        const json = await request.json();
        const body = SchedulePostSchema.parse(json);

        // 3. Call Unified Scheduler Service
        const result = await SchedulerService.schedulePost({
            userId,
            accountId: body.accountId,
            platform: body.platform,
            contentType: body.contentType,
            contentData: {
                title: body.contentData.title,
                description: body.contentData.description,
                mediaUrl: body.contentData.mediaUrl,
                thumbnailUrl: body.contentData.thumbnailUrl
            },
            scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
            timezone: body.timezone
        });

        return NextResponse.json({
            success: true,
            message: result.isScheduled ? "Post scheduled successfully" : "Post dispatched for immediate publishing",
            scheduled_at_utc: result.scheduleTime.toISOString(),
            postId: result.trackingId || result.scheduledPostId,
            inngestEvent: result.inngestEventId
        });

    } catch (error: any) {
        if (error instanceof ZodError) {
            return NextResponse.json({
                error: "Validation failed",
                details: error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`)
            }, { status: 400 });
        }

        console.error("[Schedule API] CRITICAL Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
