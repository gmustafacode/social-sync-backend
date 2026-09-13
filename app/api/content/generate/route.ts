import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { AIService } from "@/lib/ai-service";
import { GenerateContentSchema } from "@/lib/validations/api";
import { apiResponse, handleApiError } from "@/lib/api-utils";

export async function POST(req: NextRequest) {
    try {
        // 1. Authentication Check
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return apiResponse.unauthorized();
        }
        const userId = (session.user as any).id;

        // 2. Input Validation (Zod)
        const json = await req.json();
        const body = GenerateContentSchema.parse(json);

        // 3. AIService Execution — runs the full unified pipeline
        console.log(`[Content Generate API] Starting for User ${userId}, Topic: ${body.topic}, PostType: ${body.postType}`);
        const intelligenceResult = await AIService.runIntelligenceLayer(
            userId,
            body.topic,
            body.audience,
            body.tone,
            body.postType  // ← pass universal post type through to pipeline
        );

        if (!intelligenceResult) {
            return apiResponse.error("Failed to generate intelligent content", 500);
        }

        // 4. Response Mapping
        return NextResponse.json({
            content: intelligenceResult.rawContent,
            platformContent: intelligenceResult.platformContent,
            safety: intelligenceResult.safetyStatus,
            analytics: intelligenceResult.analytics,
            feedback: intelligenceResult.feedbackPrompt
        });

    } catch (error: any) {
        return handleApiError(error);
    }
}
