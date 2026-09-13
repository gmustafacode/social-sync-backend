import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { AIService } from "@/lib/ai-service";
import { apiResponse, handleApiError } from "@/lib/api-utils";

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return apiResponse.unauthorized();
        }

        const body = await req.json();
        const { content, platforms } = body;

        if (!content || typeof content !== 'string') {
            return apiResponse.error("Content is required", 400);
        }

        const moderationResult = await AIService.moderateAndOptimize(
            content,
            platforms || ["General"]
        );

        return apiResponse.success(moderationResult);

    } catch (error: any) {
        return handleApiError(error);
    }
}
