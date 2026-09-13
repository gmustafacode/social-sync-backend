
import axios from 'axios';
import { NormalizedContent } from '../types';

export async function fetchNewsAPI(category: string): Promise<NormalizedContent[]> {
    const apiKey = process.env.NEWS_API_KEY;

    if (!apiKey) {
        console.error('NewsAPI key missing');
        return [];
    }

    try {
        const response = await axios.get('https://newsapi.org/v2/top-headlines', {
            params: {
                category,
                language: 'en',
                apiKey
            },
            timeout: 20000
        });

        return response.data.articles.map((article: any) => ({
            source: 'news_api' as const,
            contentType: 'text' as const,
            title: article.title,
            summary: article.description || '',
            rawContent: article.content || '',
            mediaUrl: article.urlToImage || '',
            sourceUrl: article.url,
            author: article.author || article.source?.name || '',
            publishedAt: new Date(article.publishedAt),
            language: 'en',
            metadata: {
                sourceName: article.source?.name
            }
        }));
    } catch (error: any) {
        console.error(`NewsAPI fetch failed for ${category}:`, error.response?.data || error.message);
        return [];
    }
}
