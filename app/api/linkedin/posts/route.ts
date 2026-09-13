
import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import { inngest } from "@/lib/inngest/client";

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const userId = (session.user as any).id;

        // 0. Rate Limiting Check
        const { checkPostingLimits } = await import("@/lib/limits");
        const limitCheck = await checkPostingLimits(userId, 'linkedin');
        if (!limitCheck.allowed) {
            return NextResponse.json({ error: limitCheck.error || "Rate limit exceeded" }, { status: 429 });
        }

        const body = await request.json();
        const {
            socialAccountId,
            postType, // TEXT, IMAGE, ARTICLE
            youtubeUrl,
            title,
            description,
            thumbnailUrl,
            mediaUrls,
            targetType,
            groupIds,
            visibility,
            scheduledAt
        } = body;

        // 1. Core Validation
        // 1. Core Validation & Security
        if (!socialAccountId) {
            return NextResponse.json({ error: "Please select a LinkedIn account" }, { status: 400 });
        }

        // Security: Verify account ownership
        const account = await db.socialAccount.findFirst({
            where: {
                id: socialAccountId,
                userId
            }
        });

        if (!account) {
            return NextResponse.json({ error: "Invalid social account or unauthorized access" }, { status: 403 });
        }

        if (account.status !== 'active') {
            return NextResponse.json({ error: `LinkedIn account is ${account.status}. Please reconnect it.` }, { status: 403 });
        }

        // Validate scheduledAt with comprehensive checks
        if (scheduledAt) {
            const scheduledDate = new Date(scheduledAt);

            // Check if date is valid
            if (isNaN(scheduledDate.getTime())) {
                return NextResponse.json({ error: "Invalid scheduled date format" }, { status: 400 });
            }

            // Check if date is in the future (with 1 minute buffer for clock skew)
            const now = new Date();
            const oneMinuteFromNow = new Date(now.getTime() + 60 * 1000);
            if (scheduledDate < oneMinuteFromNow) {
                return NextResponse.json({ error: "Scheduled time must be at least 1 minute in the future" }, { status: 400 });
            }

            // Check if date is not too far in the future (e.g., max 1 year)
            const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
            if (scheduledDate > oneYearFromNow) {
                return NextResponse.json({ error: "Scheduled time cannot be more than 1 year in the future" }, { status: 400 });
            }
        }

        if (!description && postType === 'TEXT') {
            return NextResponse.json({ error: "Post content cannot be empty for text posts" }, { status: 400 });
        }

        // 2. Character Limit Enforcement (LinkedIn Policy)
        if (description && description.length > 3000) {
            return NextResponse.json({ error: "LinkedIn posts are limited to 3000 characters" }, { status: 400 });
        }

        if (title && title.length > 200) {
            return NextResponse.json({ error: "Headline is too long (max 200 characters)" }, { status: 400 });
        }

        // 3. Category Specific Logic
        const ALLOWED_POST_TYPES = ['TEXT', 'IMAGE', 'IMAGE_TEXT', 'VIDEO', 'VIDEO_TEXT', 'ARTICLE', 'GROUP_POST'];
        const normalizedType = (postType || "TEXT").toUpperCase();

        if (!ALLOWED_POST_TYPES.includes(normalizedType)) {
            return NextResponse.json({ error: `Invalid post category: ${postType}` }, { status: 400 });
        }

        const isArticleType = ['ARTICLE', 'VIDEO', 'VIDEO_TEXT', 'GROUP_POST'].includes(normalizedType);
        const isImageType = ['IMAGE', 'IMAGE_TEXT'].includes(normalizedType);

        if (isArticleType && !youtubeUrl && !mediaUrls?.length) {
            return NextResponse.json({ error: "A URL or media asset is required for Link/Video/Group posts" }, { status: 400 });
        }

        if (isImageType && (!mediaUrls || mediaUrls.length === 0)) {
            return NextResponse.json({ error: "At least one image URL or asset is required" }, { status: 400 });
        }

        if (targetType === 'GROUP' && (!groupIds || groupIds.length === 0)) {
            return NextResponse.json({ error: "Please select at least one group for group distribution" }, { status: 400 });
        }

        if (targetType === 'GROUP' && !youtubeUrl && (!mediaUrls || mediaUrls.length === 0) && !description) {
            return NextResponse.json({ error: "Group posts must have at least text or media" }, { status: 400 });
        }

        // 4. Array Sanitization & Validation (Prevent injection and resource exhaustion)
        let sanitizedMediaUrls: string[] = [];
        if (mediaUrls && Array.isArray(mediaUrls)) {
            // Filter out non-strings, empty values, and validate URL format
            sanitizedMediaUrls = mediaUrls
                .filter((url: any) => typeof url === 'string' && url.trim().length > 0)
                .map((url: string) => url.trim())
                .filter((url: string) => {
                    try {
                        new URL(url);
                        return true;
                    } catch {
                        console.warn(`[LinkedIn API] Invalid media URL filtered: ${url}`);
                        return false;
                    }
                })
                .slice(0, 10); // LinkedIn max: 10 images per post
        }

        let sanitizedGroupIds: string[] = [];
        if (groupIds && Array.isArray(groupIds)) {
            // Filter out non-strings and empty values
            sanitizedGroupIds = groupIds
                .filter((id: any) => typeof id === 'string' && id.trim().length > 0)
                .map((id: string) => id.trim())
                .slice(0, 50); // Reasonable limit to prevent abuse
        }

        // 5. Create LinkedInPost record in DB (Content Data Layer)
        const isScheduled = !!scheduledAt;
        const scheduleTime = isScheduled ? new Date(scheduledAt) : new Date();

        const post = await db.linkedInPost.create({
            data: {
                userId,
                socialAccountId,
                postType: postType || "TEXT",
                youtubeUrl: youtubeUrl || null,
                title: title || null,
                description: description || "",
                thumbnailUrl: thumbnailUrl || null,
                mediaUrls: sanitizedMediaUrls,
                targetType: targetType || "FEED",
                groupIds: sanitizedGroupIds,
                visibility: visibility || "PUBLIC",
                status: isScheduled ? "SCHEDULED" : "PENDING",
                scheduledAt: scheduleTime,
            }
        });

        // 6. Create ScheduledPost record (The Scheduling Controller)
        const scheduledPost = await db.scheduledPost.create({
            data: {
                userId,
                socialAccountId,
                platform: 'linkedin',
                postType: postType || "TEXT",
                contentText: description || "",
                mediaUrl: (sanitizedMediaUrls && sanitizedMediaUrls.length > 0) ? sanitizedMediaUrls[0] : (thumbnailUrl || null),
                targetType: targetType || "FEED",
                targetId: (sanitizedGroupIds && sanitizedGroupIds.length > 0) ? sanitizedGroupIds[0] : null,
                scheduledAt: scheduleTime,
                timezone: body.timezone || "UTC",
                status: isScheduled ? "pending" : "processing",
                contentId: post.id
            }
        });

        // 7. DISPATCH TO INNGEST ENGINE
        let inngestResult = null;
        if (!isScheduled) {
            // IMMEDIATE: Publish right now via Inngest event
            console.log(`[LinkedIn API] Instant publish. Dispatching post ${post.id} to Inngest...`)
            inngestResult = await inngest.send({
                name: "linkedin/post.publish",
                data: {
                    postId: post.id,
                    scheduledPostId: scheduledPost.id
                }
            })
        } else {
            // SCHEDULED: Fire immediately but Inngest will sleep until the scheduled time
            // This is more reliable than polling cron — guaranteed precise delivery
            console.log(`[LinkedIn API] Scheduled publish at ${scheduleTime.toISOString()}. Dispatching sleep-until event...`)
            inngestResult = await inngest.send({
                name: "linkedin/post.schedule",
                data: {
                    postId: post.id,
                    scheduledPostId: scheduledPost.id,
                    scheduledFor: scheduleTime.toISOString()
                }
            })
        }

        return NextResponse.json({
            success: true,
            message: isScheduled ? "Post scheduled successfully" : "Post dispatched for immediate publishing",
            scheduled_at_utc: scheduleTime.toISOString(),
            postId: post.id,
            inngestEvent: inngestResult?.ids?.[0] || null
        });


    } catch (error: any) {
        console.error("[LinkedIn API] Create Post Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const userId = (session.user as any).id;
        const posts = await db.linkedInPost.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: {
                socialAccount: {
                    select: {
                        platformAccountId: true,
                        metadata: true
                    }
                }
            }
        });

        return NextResponse.json(posts);
    } catch (error: any) {
        console.error("[LinkedIn API] Fetch Posts Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
