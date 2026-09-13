
import { getServerSession } from "next-auth";
import db from "@/lib/db";
import { apiResponse, handleApiError } from "@/lib/api-utils";
import { z } from "zod";

const UpdateStatusSchema = z.object({
    postId: z.string().uuid(),
    status: z.string(),
    externalPostId: z.string().optional().nullable(),
    error: z.string().optional().nullable(),
});

export async function POST(req: Request) {
    try {
        // 1. Security Check: Verify secret if defined
        const secret = req.headers.get('x-webhook-secret');
        if (process.env.WEBHOOK_SECRET && secret !== process.env.WEBHOOK_SECRET) {
            console.warn("[Security] Unauthorized attempt to update post status from", req.headers.get('x-forwarded-for') || 'unknown');
            return apiResponse.unauthorized("Unauthorized secret mismatch");
        }

        const json = await req.json();
        const body = UpdateStatusSchema.parse(json);
        const { postId, status, externalPostId, error } = body;

        // 2. Validate and Normalize Status
        const validStatuses = ["pending", "processing", "published", "failed", "cancelled"];

        let normalizedStatus = status.toLowerCase();
        if (status === "PUBLISHED") normalizedStatus = "published";
        if (status === "FAILED") normalizedStatus = "failed";
        if (status === "SCHEDULED") normalizedStatus = "pending";

        if (!validStatuses.includes(normalizedStatus)) {
            return apiResponse.error(`Invalid status: ${status}`, 400);
        }

        // 3. Update Record
        await db.scheduledPost.update({
            where: { id: postId },
            data: {
                status: normalizedStatus as any,
                externalPostId: externalPostId || undefined,
                lastError: error || undefined,
                updatedAt: new Date(),
            }
        });

        return apiResponse.success({ success: true });
    } catch (error) {
        return handleApiError(error);
    }
}
