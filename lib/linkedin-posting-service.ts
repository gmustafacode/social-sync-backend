
import axios from 'axios';
import { LinkedInAuthService } from './linkedin-auth-service';
import db from './db';

export interface LinkedInPostOptions {
    title?: string;
    description: string;
    youtubeUrl?: string;
    thumbnailUrl?: string;
    mediaUrls?: string[];
    visibility: 'PUBLIC' | 'CONTAINER';
    groupIds?: string[];
    postType?: string;
}

export class LinkedInPostingService {
    /**
     * Publishes a post to LinkedIn (Feed and/or Groups).
     */
    /**
     * Publishes a post to LinkedIn (Feed and/or Groups).
     * Supports both LinkedInPost ID and ContentQueue ID.
     */
    static async publishPost(postId: string, socialAccountId?: string) {
        // 1. Fetch content from multiple possible sources
        let isLinkedInTable = true;
        let content: any = await db.linkedInPost.findUnique({
            where: { id: postId },
            include: { socialAccount: true }
        });

        if (!content) {
            isLinkedInTable = false;
            // Fallback: Try ContentQueue (General Scheduler)
            const queuedItem = await db.contentQueue.findUnique({
                where: { id: postId }
            });

            if (queuedItem) {
                // If we're coming from ContentQueue, we MUST have a socialAccountId
                if (!socialAccountId) {
                    throw new Error("Social account ID is required for generic content queue items");
                }

                const account = await db.socialAccount.findUnique({ where: { id: socialAccountId } });
                if (!account) throw new Error("Linked social account not found");

                // Map ContentQueue to LinkedInPost-like structure
                content = {
                    id: queuedItem.id,
                    userId: queuedItem.userId,
                    socialAccountId: account.id,
                    postType: queuedItem.contentType === 'video' ? 'VIDEO' : (queuedItem.mediaUrl ? 'IMAGE_TEXT' : 'TEXT'),
                    youtubeUrl: queuedItem.sourceUrl?.includes('youtube.com') || queuedItem.sourceUrl?.includes('youtu.be') ? queuedItem.sourceUrl : null,
                    title: queuedItem.title,
                    description: queuedItem.summary || queuedItem.title || "",
                    thumbnailUrl: queuedItem.mediaUrl,
                    mediaUrls: queuedItem.mediaUrl ? [queuedItem.mediaUrl] : [],
                    targetType: 'FEED',
                    visibility: 'PUBLIC',
                    status: 'PENDING',
                    socialAccount: account,
                    groupIds: []
                };
            }
        }

        if (!content) throw new Error(`Post or Content ${postId} not found in any supported table.`);

        // Idempotency Check: Prevent double-posting
        if (content.status === 'PUBLISHED' && content.linkedinPostUrn) {
            console.log(`[LinkedInPosting] Post ${postId} already published. URN: ${content.linkedinPostUrn}`);
            return {
                status: 'PUBLISHED',
                results: content.linkedinPostUrn.split(', '),
                errors: []
            };
        }

        // 1. Get valid access token (refreshes if needed)
        const accessToken = await LinkedInAuthService.getValidToken(content.socialAccountId);

        // 2. Resolve LinkedIn Identity (URN)
        let authorUrn = content.socialAccount.platformAccountId;
        let metadata: any = {};
        try {
            metadata = typeof content.socialAccount.metadata === 'string'
                ? JSON.parse(content.socialAccount.metadata)
                : (content.socialAccount.metadata || {});
        } catch (e) { }

        // If not a full URN, attempt to resolve it correctly
        if (!authorUrn || !authorUrn.includes('urn:li:')) {
            console.log(`[LinkedInPosting] Normalizing author URN for account ${content.socialAccountId}. Current: ${authorUrn}`);
            try {
                const { getLinkedInProfile } = await import('./linkedin-token-validator');
                const profile = await getLinkedInProfile(accessToken);

                // Determine prefix: metadata > profile suggested > fallback person
                const prefix = metadata.type === 'organization' ? 'urn:li:organization:' :
                    (metadata.type === 'person' ? 'urn:li:person:' :
                        ((profile as any).suggestedUrnPrefix || 'urn:li:person:'));

                authorUrn = profile.id.startsWith('urn:li:') ? profile.id : `${prefix}${profile.id}`;

                console.log(`[LinkedInPosting] Resolved URN: ${authorUrn} (Source: ${profile.source})`);

                // Save resolved URN for future use
                await db.socialAccount.update({
                    where: { id: content.socialAccountId },
                    data: { platformAccountId: authorUrn }
                });
            } catch (error: any) {
                console.error("[LinkedInPosting] Identity resolution failed:", error);
            }
        }

        if (!authorUrn) throw new Error("Could not resolve LinkedIn User/Organization ID");

        // Validation & Truncation
        let description = content.description || "";
        if (description.length > 3000) {
            console.warn(`[LinkedInPosting] Description exceeds 3000 chars (${description.length}). Truncating...`);
            description = description.substring(0, 2997) + "...";
        }

        if (description.length === 0 && !content.mediaUrls?.length && !content.youtubeUrl) {
            throw new Error("Post content cannot be empty (must have text or media)");
        }

        const results: string[] = [];
        const errors: string[] = [];

        // 3. Auto-generate or Scrape thumbnail
        let finalThumbnailUrl = content.thumbnailUrl;
        const targetUrl = content.youtubeUrl || (content.mediaUrls?.length > 0 ? content.mediaUrls[0] : null);

        if (!finalThumbnailUrl && targetUrl) {
            if (content.youtubeUrl) {
                const metadata = LinkedInPostingService.getYoutubeMetadata(content.youtubeUrl);
                if (metadata) {
                    try {
                        await axios.head(metadata.thumbnailUrl, { timeout: 5000 });
                        finalThumbnailUrl = metadata.thumbnailUrl;
                    } catch (e) {
                        finalThumbnailUrl = `https://i.ytimg.com/vi/${metadata.videoId}/hqdefault.jpg`;
                    }
                }
            } else {
                // Proactive Scraper for generic links
                try {
                    const response = await axios.get(targetUrl, {
                        timeout: 10000,
                        maxContentLength: 1024 * 1024,
                        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SocialSyncBot/1.0)' }
                    });
                    const html = response.data;
                    const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
                    if (ogMatch && ogMatch[1]) finalThumbnailUrl = ogMatch[1];
                } catch (e) { }
            }
        }

        // 4. Handle Feed Post (Including synonyms)
        const isFeedPost = content.targetType === 'FEED' ||
            content.targetType === 'Person' ||
            content.targetType === 'Profile' ||
            !content.targetType;

        if (isFeedPost) {
            try {
                const urn = await this.createUgcPost(accessToken, authorUrn, {
                    postType: content.postType,
                    title: content.title || undefined,
                    description: description,
                    youtubeUrl: content.youtubeUrl || undefined,
                    thumbnailUrl: finalThumbnailUrl || undefined,
                    mediaUrls: content.mediaUrls,
                    visibility: content.visibility === 'CONTAINER' ? 'CONTAINER' : 'PUBLIC'
                });
                results.push(urn);
            } catch (err: any) {
                const data = err.response?.data;
                const errorMsg = data?.message || err.message || "Unknown error";
                const duplicateMatch = errorMsg.match(/duplicate of (urn:li:[a-zA-Z0-9:]+)/);

                if (duplicateMatch && duplicateMatch[1]) {
                    results.push(duplicateMatch[1]);
                } else {
                    errors.push(`Feed post failed: ${errorMsg}`);
                }
            }
        }

        // 5. Handle Group Posts
        if (content.targetType === 'GROUP' && content.groupIds?.length > 0) {
            for (const groupId of content.groupIds) {
                try {
                    const urn = await this.createUgcPost(accessToken, authorUrn, {
                        postType: content.postType,
                        title: content.title || undefined,
                        description: description,
                        youtubeUrl: content.youtubeUrl || undefined,
                        thumbnailUrl: finalThumbnailUrl || undefined,
                        mediaUrls: content.mediaUrls,
                        visibility: 'CONTAINER',
                        groupIds: [groupId]
                    });
                    results.push(urn);
                } catch (err: any) {
                    const errorMsg = err.response?.data?.message || err.message;
                    errors.push(`Group ${groupId} failed: ${errorMsg}`);
                }
            }
        }

        // 6. Update Status (Source agnostic)
        // CRITICAL FIX: If no attempts were made, report as FAILED instead of silently logging success
        const finalStatus = results.length > 0
            ? (errors.length === 0 ? 'PUBLISHED' : 'PARTIAL_SUCCESS')
            : (errors.length > 0 ? 'FAILED' : 'FAILED_NO_ATTEMPT');
        const finalStatusUpper = finalStatus.toUpperCase();
        const updatePayload = {
            status: finalStatusUpper,
            linkedinPostUrn: results.join(', '),
            errorMessage: errors.length > 0 ? errors.join(' | ').substring(0, 1000) : null,
            updatedAt: new Date()
        };

        // Update the actual source table
        if (isLinkedInTable) {
            await db.linkedInPost.update({ where: { id: postId }, data: updatePayload as any });
        } else {
            // Update ContentQueue if that was the source
            await db.contentQueue.update({
                where: { id: postId },
                data: {
                    status: finalStatusUpper === 'PUBLISHED' ? 'published' : (finalStatusUpper === 'FAILED' ? 'failed' : 'pending'),
                    publishedAt: finalStatusUpper === 'PUBLISHED' ? new Date() : null
                }
            }).catch(() => { });
        }

        return { status: finalStatus, results, errors };
    }

    /**
     * Creates a UGC post via LinkedIn API.
     */
    private static async createUgcPost(
        accessToken: string,
        authorUrn: string,
        options: LinkedInPostOptions
    ): Promise<string> {
        let { title, description, youtubeUrl, thumbnailUrl, visibility, groupIds, postType, mediaUrls } = options;

        // Container is for groups
        const containerUrn = groupIds && groupIds.length > 0 ? `urn:li:group:${groupIds[0]}` : undefined;

        let shareMediaCategory = "NONE";
        let media: any[] = [];
        let finalDescription = description;

        // Enhanced Media Categorization
        const hasMediaUrls = mediaUrls && mediaUrls.length > 0;
        const isImage = postType === 'IMAGE' || postType === 'IMAGE_TEXT' || (hasMediaUrls && !youtubeUrl);
        const isVideo = postType === 'VIDEO' || postType === 'VIDEO_TEXT' || !!youtubeUrl;
        const isArticle = postType === 'ARTICLE';

        // STRATEGY: For maximum "Big Thumbnail" impact, we prefer the IMAGE category
        // with a native asset upload, even for links and videos.
        if (isImage || (thumbnailUrl && (isVideo || isArticle))) {
            shareMediaCategory = "IMAGE";

            // Process images: Download and upload to LinkedIn to get Asset URNs
            const mediaSources = isImage ? (mediaUrls || []) : [thumbnailUrl];

            const assets: string[] = [];
            for (const url of mediaSources) {
                if (!url) continue;
                if (url.startsWith('urn:li:digitalmediaAsset')) {
                    assets.push(url);
                    continue;
                }
                try {
                    const assetUrn = await this.uploadImageToLinkedIn(accessToken, authorUrn, url);
                    if (assetUrn) assets.push(assetUrn);
                } catch (e) {
                    console.error("[LinkedInPosting] Image upload failed for URL:", url, e);
                }
            }

            if (assets.length > 0) {
                media = assets.map(assetUrn => ({
                    status: "READY",
                    media: assetUrn,
                    // For single hero images, we omit title/description inside 'media'
                    // to force LinkedIn to prioritize the image as a "Full Width" element.
                    ...(assets.length > 1 ? {
                        description: { text: description.substring(0, 200) },
                        title: { text: title || "Gallery Image" }
                    } : {})
                }));

                // If this was originally a video/article, inject the link into the caption
                if (isVideo || isArticle) {
                    const link = youtubeUrl || (hasMediaUrls ? mediaUrls![0] : "");
                    if (link && !finalDescription.includes(link)) {
                        // Ensure appending the link doesn't exceed 3000 chars
                        const separator = "\n\n🔗 ";
                        const neededSpace = separator.length + link.length;

                        if (finalDescription.length + neededSpace > 3000) {
                            finalDescription = finalDescription.substring(0, 3000 - neededSpace - 3) + "...";
                        }
                        finalDescription = `${finalDescription}${separator}${link}`;
                    }
                }
            } else if (isVideo || isArticle) {
                // Total fallback to ARTICLE if native upload fails
                shareMediaCategory = "ARTICLE";
                media = [{
                    status: "READY",
                    description: { text: description },
                    originalUrl: youtubeUrl || (hasMediaUrls ? mediaUrls![0] : undefined),
                    title: { text: title || (isVideo ? "Shared Video" : "Shared Article") },
                    thumbnails: thumbnailUrl ? [{ url: thumbnailUrl }] : []
                }];
            }
        } else if (isVideo || isArticle) {
            shareMediaCategory = "ARTICLE";
            media = [{
                status: "READY",
                description: { text: description },
                originalUrl: youtubeUrl || (hasMediaUrls ? mediaUrls![0] : undefined),
                title: { text: title || (isVideo ? "Shared Video" : "Shared Article") }
            }];
        }

        const payload = {
            author: authorUrn,
            lifecycleState: "PUBLISHED",
            specificContent: {
                "com.linkedin.ugc.ShareContent": {
                    shareCommentary: {
                        text: finalDescription
                    },
                    shareMediaCategory: shareMediaCategory,
                    media: shareMediaCategory === "NONE" ? undefined : media
                }
            },
            visibility: {
                "com.linkedin.ugc.MemberNetworkVisibility": visibility
            }
        };

        console.log(`[LinkedInPosting] Creating UGC Post with author: ${authorUrn}, category: ${shareMediaCategory}`);

        if (visibility === 'CONTAINER' && containerUrn) {
            (payload as any).containerEntity = containerUrn;
        }

        const response = await axios.post('https://api.linkedin.com/v2/ugcPosts', payload, {
            timeout: 30000, // 30s timeout for post creation
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'X-Restli-Protocol-Version': '2.0.0',
                'Content-Type': 'application/json'
            }
        });

        if (response.status !== 201) {
            throw new Error(`LinkedIn API Error: ${response.status} ${JSON.stringify(response.data)}`);
        }

        return response.data.id;
    }

    /**
     * Downloads an image from a URL and uploads it to LinkedIn to get an Asset URN.
     * This is required for "Native" image posts (Large Media Cards).
     */
    private static async uploadImageToLinkedIn(accessToken: string, authorUrn: string, imageUrl: string): Promise<string> {
        console.log(`[LinkedInPosting] Uploading image: ${imageUrl}`);

        // 1. Download the image with size limit (5MB) and memory protection
        const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

        const imageRes = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 30000, // 30s timeout
            maxContentLength: MAX_IMAGE_SIZE, // Prevent massive downloads
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (imageRes.data.length > MAX_IMAGE_SIZE) {
            throw new Error(`Media asset exceeds 5MB limit (${(imageRes.data.length / 1024 / 1024).toFixed(2)}MB)`);
        }

        const imageBuffer = Buffer.from(imageRes.data);

        // 2. Register the upload
        const registerPayload = {
            registerUploadRequest: {
                recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
                owner: authorUrn,
                serviceRelationships: [{
                    relationshipType: "OWNER",
                    identifier: "urn:li:userGeneratedContent"
                }]
            }
        };

        const registerRes = await axios.post('https://api.linkedin.com/v2/assets?action=registerUpload', registerPayload, {
            timeout: 30000,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'X-Restli-Protocol-Version': '2.0.0'
            }
        });

        const uploadUrl = registerRes.data.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl;
        const assetUrn = registerRes.data.value.asset;

        // 3. Perform the binary upload
        await axios.put(uploadUrl, imageBuffer, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': imageRes.headers['content-type'] || 'image/jpeg'
            }
        });

        console.log(`[LinkedInPosting] Image registered as native asset: ${assetUrn}`);
        return assetUrn;
    }

    /**
     * Extracts YouTube ID and generates metadata.
     */
    static getYoutubeMetadata(url: string) {
        const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
        const match = url.match(regExp);
        const videoId = (match && match[7].length === 11) ? match[7] : null;

        if (!videoId) return null;

        return {
            videoId,
            thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
            embedUrl: `https://www.youtube.com/embed/${videoId}`
        };
    }
}
