import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserLimits } from "@/lib/limits";
import { apiResponse, handleApiError } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return apiResponse.unauthorized();
        }

        const userId = (session.user as any).id;

        // Search Params for specific platform, otherwise default to linkedin
        const { searchParams } = new URL(req.url);
        const platform = searchParams.get("platform") || "linkedin";

        const limits = await getUserLimits(userId, platform);

        return apiResponse.success(limits);

    } catch (error: any) {
        return handleApiError(error);
    }
}