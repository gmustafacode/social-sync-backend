
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import { apiResponse, handleApiError } from "@/lib/api-utils";
import { z } from "zod";

const ContentQueueSchema = z.object({
    contentType: z.enum(['text', 'image', 'video', 'link']).default('text'),
    contentData: z.object({
        title: z.string().optional(),
        summary: z.string().optional(),
        text: z.string().optional(),
        content: z.string().optional(),
        mediaUrl: z.string().url().optional(),
    }),
    viralScore: z.number().min(0).max(100).optional().default(0),
    source: z.string().optional().default('manual'),
    sourceUrl: z.string().url().optional().nullable(),
    mediaUrl: z.string().url().optional().nullable(),
});

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return apiResponse.unauthorized();

        const userId = (session.user as any).id;

        const queue = await db.contentQueue.findMany({
            where: {
                OR: [
                    { userId },
                    { userId: null }
                ]
            },
            orderBy: [
                { viralScore: 'desc' },
                { createdAt: 'desc' }
            ],
            include: {
                postHistory: {
                    where: { userId } // Only show history relative to this user
                }
            }
        });
        return apiResponse.success(queue);
    } catch (error) {
        return handleApiError(error);
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return apiResponse.unauthorized();
        const userId = (session.user as any).id;

        const json = await request.json();
        const body = ContentQueueSchema.parse(json);

        if (body.sourceUrl) {
            const existing = await db.contentQueue.findUnique({ where: { sourceUrl: body.sourceUrl } });
            if (existing) {
                return apiResponse.error("Content already exists in queue", 409);
            }
        }

        const item = await db.contentQueue.create({
            data: {
                userId,
                contentType: body.contentType,
                source: body.source,
                sourceUrl: body.sourceUrl,
                title: body.contentData.title || null,
                summary: body.contentData.summary || null,
                rawContent: body.contentData.text || body.contentData.content || null,
                mediaUrl: body.mediaUrl || body.contentData.mediaUrl || null,
                viralScore: body.viralScore,
                status: 'pending'
            }
        });
        return apiResponse.success(item, 201);
    } catch (error) {
        return handleApiError(error);
    }
}
