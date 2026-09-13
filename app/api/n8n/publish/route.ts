
import { NextResponse } from "next/server";
import db from "@/lib/db";
import { LinkedInPostingService } from "@/lib/linkedin-posting-service";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { postId } = body;

        // Security: N8N_API_KEY Check
        const authHeader = req.headers.get("Authorization");
        const apiKey = authHeader?.replace("Bearer ", "");
        const expectedKey = process.env.N8N_API_KEY;

        if (expectedKey && apiKey !== expectedKey) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        if (!postId) {
            return new NextResponse("Missing postId", { status: 400 });
        }

        // Use the dedicated service to publish the post
        // This service implements the logic to:
        // 1. Fetch the user's LinkedIn ID
        // 2. Extract YouTube thumbnail (if applicable)
        // 3. Construct the specific UGC payload (Article/Image/etc)
        // 4. Post to Feed and/or Groups
        const result = await LinkedInPostingService.publishPost(postId);

        if (result.status === 'FAILED') {
            return NextResponse.json({
                success: false,
                errors: result.errors
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            status: result.status,
            results: result.results
        });

    } catch (error: any) {
        console.error("POST /api/n8n/publish Error:", error);
        return NextResponse.json({
            error: "Internal Server Error"
        }, { status: 500 });
    }
}
