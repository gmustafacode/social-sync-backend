
import Parser from 'rss-parser';
import { NormalizedContent } from '../types';

const parser = new Parser();

export async function fetchRSS(url: string): Promise<NormalizedContent[]> {
    try {
        const feed = await parser.parseURL(url);
        return feed.items.map(item => ({
            source: 'rss' as const,
            contentType: 'text' as const,
            title: item.title || 'No Title',
            summary: item.contentSnippet || item.content || '',
            rawContent: item.content || '',
            sourceUrl: item.link || '',
            author: item.creator || item.author || '',
            publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
            language: 'en',
            metadata: {
                feedTitle: feed.title,
                categories: item.categories
            }
        }));
    } catch (error) {
        console.error(`RSS fetch failed for ${url}:`, error);
        return [];
    }
}
