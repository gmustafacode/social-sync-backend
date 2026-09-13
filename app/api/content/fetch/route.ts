
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { fetchRSS } from '@/lib/ingestion/connectors/rss';
import { fetchReddit } from '@/lib/ingestion/connectors/reddit';
import { fetchNewsAPI } from '@/lib/ingestion/connectors/news';
import { fetchUnsplash } from '@/lib/ingestion/connectors/unsplash';
import { fetchPexels } from '@/lib/ingestion/connectors/pexels';
import { processIngestedContent } from '@/lib/ingestion/processor';
import { NormalizedContent, IngestionResult } from '@/lib/ingestion/types';

export async function POST(request: Request) {
    // 1. Authenticate user
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { sources, category, query } = body;

        if (!sources || !Array.isArray(sources)) {
            return NextResponse.json({ error: 'Missing sources array' }, { status: 400 });
        }

        const results: IngestionResult[] = [];
        const searchCategory = category || 'technology';
        const searchQuery = query || category || 'technology';

        for (const source of sources) {
            let items: NormalizedContent[] = [];

            switch (source) {
                case 'rss':
                    // Example RSS feed - in production these might come from user preferences or a central list
                    items = await fetchRSS('https://feeds.feedburner.com/TechCrunch/');
                    break;
                case 'reddit':
                    items = await fetchReddit(searchCategory);
                    break;
                case 'news_api':
                    items = await fetchNewsAPI(searchCategory);
                    break;
                case 'unsplash':
                    items = await fetchUnsplash(searchQuery);
                    break;
                case 'pexels':
                    items = await fetchPexels(searchQuery);
                    break;
                default:
                    console.warn(`Unsupported source: ${source}`);
                    continue;
            }

            const result = await processIngestedContent(source, items);
            results.push(result);
        }

        const summary = results.reduce(
            (acc, curr) => ({
                fetched: acc.fetched + curr.fetched,
                saved: acc.saved + curr.saved,
                duplicates: acc.duplicates + curr.duplicates,
                errors: acc.errors + curr.errors
            }),
            { fetched: 0, saved: 0, duplicates: 0, errors: 0 }
        );

        return NextResponse.json({
            status: 'success',
            ...summary,
            details: results
        });
    } catch (error: any) {
        console.error('Manual fetch failed:', error);
        return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
    }
}
