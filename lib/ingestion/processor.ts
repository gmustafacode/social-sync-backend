
import db from '../db';
import { NormalizedContent, IngestionResult, ContentSourceType } from './types';

export async function processIngestedContent(
    source: ContentSourceType,
    items: NormalizedContent[]
): Promise<IngestionResult> {
    const startTime = Date.now();
    let savedCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    for (const item of items) {
        try {
            // 1. Validation
            if (!item.title || !item.sourceUrl) {
                console.warn(`[Ingestion] Missing title or URL for ${source}:`, item.title);
                errorCount++;
                continue;
            }

            // Check content length for text sources
            const contentLength = Math.max(item.summary?.length || 0, item.rawContent?.length || 0);
            if (item.contentType === 'text' && contentLength < 100) {
                console.warn(`[Ingestion] Content too short (${contentLength} chars) for ${item.title}`);
                errorCount++;
                continue;
            }

            // 2. Duplicate Check
            const existingByUrl = await db.contentQueue.findUnique({
                where: { sourceUrl: item.sourceUrl }
            });

            if (existingByUrl) {
                console.log(`[Ingestion] Duplicate URL ignored: ${item.title}`);
                duplicateCount++;
                continue;
            }

            // Check if title exists within last 7 days
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const existingByTitle = await db.contentQueue.findFirst({
                where: {
                    title: item.title,
                    createdAt: {
                        gte: sevenDaysAgo
                    }
                }
            });

            if (existingByTitle) {
                duplicateCount++;
                continue;
            }

            // 3. Save to Supabase (Content Queue)
            await db.contentQueue.create({
                data: {
                    source: item.source,
                    contentType: item.contentType,
                    title: item.title,
                    summary: item.summary,
                    rawContent: item.rawContent,
                    mediaUrl: item.mediaUrl,
                    sourceUrl: item.sourceUrl,
                    author: item.author,
                    language: item.language,
                    metadata: item.metadata || {},
                    publishedAt: item.publishedAt,
                    status: 'pending'
                }
            });

            savedCount++;
        } catch (error) {
            console.error(`Error processing item from ${source}:`, error);
            errorCount++;
        }
    }

    const executionTime = Date.now() - startTime;

    // 4. Log summary
    await db.ingestionLog.create({
        data: {
            source,
            fetchedCount: items.length,
            savedCount,
            duplicateCount,
            errorCount,
            executionTime
        }
    });

    return {
        source,
        fetched: items.length,
        saved: savedCount,
        duplicates: duplicateCount,
        errors: errorCount,
        executionTime
    };
}
