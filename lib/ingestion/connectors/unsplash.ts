
import axios from 'axios';
import { NormalizedContent } from '../types';

export async function fetchUnsplash(query: string): Promise<NormalizedContent[]> {
    const accessKey = process.env.UNSPLASH_ACCESS_KEY;

    if (!accessKey) {
        console.error('Unsplash access key missing');
        return [];
    }

    try {
        const response = await axios.get('https://api.unsplash.com/search/photos', {
            headers: {
                Authorization: `Client-ID ${accessKey}`
            },
            params: {
                query,
                per_page: 20
            },
            timeout: 20000
        });

        return response.data.results.map((item: any) => ({
            source: 'unsplash' as const,
            contentType: 'image' as const,
            title: item.description || item.alt_description || 'Untitled Image',
            summary: item.alt_description || '',
            sourceUrl: item.links.html,
            mediaUrl: item.urls.regular,
            author: item.user.name,
            publishedAt: new Date(item.created_at),
            language: 'en',
            metadata: {
                photographer_username: item.user.username,
                likes: item.likes,
                tags: item.tags?.map((t: any) => t.title)
            }
        }));
    } catch (error: any) {
        console.error(`Unsplash fetch failed for ${query}:`, error.response?.data || error.message);
        return [];
    }
}
