
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import db from "@/lib/db";
import { SchedulerService } from "@/lib/scheduler-service";
import { apiResponse, handleApiError } from "@/lib/api-utils";
import { PostCreateSchema } from "@/lib/validations/api";
import { z } from "zod";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return apiResponse.unauthorized();

        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status");

        const whereClause: any = { userId: (session.user as any).id };
        if (status) {
            // Validate status using z.enum logic or simple check
            const upperStatus = status.toUpperCase();
            whereClause.status = upperStatus;
        }

        const posts = await db.scheduledPost.findMany({
            where: whereClause,
            orderBy: { createdAt: "desc" },
            include: {
                socialAccount: {
                    select: {
                        platform: true,
                        metadata: true,
                    },
                },
            },
        });

        return apiResponse.success(posts);
    } catch (error) {
        return handleApiError(error);
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return apiResponse.unauthorized();
        const userId = (session.user as any).id;

        const json = await req.json();
        const body = PostCreateSchema.parse(json);

        // Verify account ownership
        const account = await db.socialAccount.findFirst({
            where: { id: body.socialAccountId, userId }
        });

        if (!account) return apiResponse.forbidden("Social account not found or unauthorized.");

        // Call Unified Scheduler Service
        const result = await SchedulerService.schedulePost({
            userId,
            accountId: body.socialAccountId,
            platform: account.platform,
            contentType: body.postType,
            contentData: {
                description: body.contentText,
                mediaUrl: body.mediaUrl || undefined
            },
            scheduledFor: body.scheduledAt ? new Date(body.scheduledAt) : null,
            targetType: body.targetType,
            targetId: body.targetId || undefined
        });

        // Return the full record for UI consistency
        const post = await db.scheduledPost.findUnique({
            where: { id: result.scheduledPostId },
            include: { socialAccount: { select: { platform: true, metadata: true } } }
        });

        return apiResponse.success(post, 201);
    } catch (error) {
        return handleApiError(error);
    }
}
