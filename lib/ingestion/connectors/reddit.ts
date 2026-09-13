
import axios from 'axios';
import { NormalizedContent } from '../types';

export async function fetchReddit(subreddit: string): Promise<NormalizedContent[]> {
    const clientId = process.env.REDDIT_CLIENT_ID;
    const clientSecret = process.env.REDDIT_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        console.error('Reddit credentials missing');
        return [];
    }

    try {
        // 1. Get Access Token (Client Credentials)
        const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        const tokenResponse = await axios.post(
            'https://www.reddit.com/api/v1/access_token',
            'grant_type=client_credentials',
            {
                headers: {
                    Authorization: `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Socialyncara/0.1.0'
                },
                timeout: 10000
            }
        );

        const accessToken = tokenResponse.data.access_token;

        // 2. Fetch from subreddit
        const response = await axios.get(
            `https://oauth.reddit.com/r/${subreddit}/new`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'User-Agent': 'Socialyncara/0.1.0'
                },
                params: {
                    limit: 25
                },
                timeout: 20000
            }
        );

        return response.data.data.children.map((child: any) => {
            const data = child.data;
            return {
                source: 'reddit' as const,
                contentType: data.is_video ? 'video' : (data.url && data.url.match(/\.(jpg|jpeg|png|gif)$/) ? 'image' : 'text'),
                title: data.title,
                summary: data.selftext || '',
                rawContent: data.selftext || '',
                mediaUrl: data.url || '',
                sourceUrl: `https://reddit.com${data.permalink}`,
                author: data.author,
                publishedAt: new Date(data.created_utc * 1000),
                language: 'en',
                metadata: {
                    subreddit: data.subreddit,
                    score: data.score,
                    num_comments: data.num_comments,
                    ups: data.ups,
                    downs: data.downs
                }
            };
        });
    } catch (error: any) {
        console.error(`Reddit fetch failed for r/${subreddit}:`, error.response?.data || error.message);
        return [];
    }
}
