
import axios from 'axios';
import { NormalizedContent } from '../types';

export async function fetchPexels(query: string, type: 'photos' | 'videos' = 'photos'): Promise<NormalizedContent[]> {
    const apiKey = process.env.PEXELS_API_KEY;

    if (!apiKey) {
        console.error('Pexels API key missing');
        return [];
    }

    try {
        const url = type === 'videos'
            ? `https://api.pexels.com/videos/search`
            : `https://api.pexels.com/v1/search`;

        const response = await axios.get(url, {
            headers: {
                Authorization: apiKey
            },
            params: {
                query,
                per_page: 20
            },
            timeout: 20000
        });

        const items = type === 'videos' ? response.data.videos : response.data.photos;

        return items.map((item: any) => ({
            source: 'pexels' as const,
            contentType: type === 'videos' ? 'video' : 'image',
            title: type === 'videos' ? `Video by ${item.user.name}` : `Photo by ${item.photographer}`,
            summary: '',
            sourceUrl: item.url,
            mediaUrl: type === 'videos' ? item.video_files[0]?.link : item.src.large,
            author: type === 'videos' ? item.user.name : item.photographer,
            publishedAt: new Date(), // Pexels search doesn't always return created_at in search results
            language: 'en',
            metadata: {
                duration: type === 'videos' ? item.duration : undefined,
                width: item.width,
                height: item.height
            }
        }));
    } catch (error: any) {
        console.error(`Pexels fetch failed for ${query} (${type}):`, error.response?.data || error.message);
        return [];
    }
}
