
import axios from 'axios';

export interface LinkedInPostParams {
    userId: string;
    title: string;
    description: string;
    youtubeUrl: string;
    thumbnailUrl: string;
    visibility: 'PUBLIC' | 'CONNECTIONS';
    groupId?: string;
}

export class LinkedInService {
    private accessToken: string;
    private baseUrl = 'https://api.linkedin.com/v2';

    constructor(accessToken: string) {
        this.accessToken = accessToken;
    }

    /**
     * Fetches current user profile to get the LinkedIn ID (URN)
     */
    async getMe() {
        // Try the modern OpenID Connect userinfo endpoint first (required for new API apps)
        try {
            const response = await axios.get(`https://api.linkedin.com/v2/userinfo`, {
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                },
            });
            // Normalize: userinfo returns 'sub', /me returns 'id'
            return {
                ...response.data,
                id: response.data.sub || response.data.id
            };
        } catch (error: any) {
            if (error.response?.status !== 403) {
                console.error('LinkedIn userinfo Error:', error.response?.data || error.message);
            }

            // Fallback to legacy /me endpoint
            try {
                const response = await axios.get(`${this.baseUrl}/me`, {
                    headers: {
                        Authorization: `Bearer ${this.accessToken}`,
                        'X-Restli-Protocol-Version': '2.0.0',
                    },
                });
                return response.data;
            } catch (fallbackError: any) {
                console.error('LinkedIn getMe Error (All attempts failed):', fallbackError.response?.data || fallbackError.message);
                throw fallbackError;
            }
        }
    }

    /**
     * Publishes a UGC Article post (matching the Python Article logic)
     */
    async publishArticlePost(params: LinkedInPostParams) {
        const { userId, title, description, youtubeUrl, thumbnailUrl, visibility, groupId } = params;

        const author = userId.startsWith('urn:li:') ? userId : `urn:li:person:${userId}`;

        const payload: any = {
            author,
            lifecycleState: 'PUBLISHED',
            specificContent: {
                'com.linkedin.ugc.ShareContent': {
                    shareCommentary: {
                        text: description,
                    },
                    shareMediaCategory: 'ARTICLE',
                    media: [
                        {
                            status: 'READY',
                            description: {
                                text: description,
                            },
                            originalUrl: youtubeUrl,
                            thumbnails: [
                                {
                                    url: thumbnailUrl,
                                },
                            ],
                            title: {
                                text: title,
                            },
                        },
                    ],
                },
            },
            visibility: {
                'com.linkedin.ugc.MemberNetworkVisibility': groupId ? 'CONTAINER' : visibility,
            },
        };

        if (groupId) {
            payload.containerEntity = groupId.startsWith('urn:li:') ? groupId : `urn:li:group:${groupId}`;
            // For groups, visibility must be CONTAINER
        }

        try {
            const response = await axios.post(`${this.baseUrl}/ugcPosts`, payload, {
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                    'X-Restli-Protocol-Version': '2.0.0',
                    'Content-Type': 'application/json',
                },
            });

            return {
                success: true,
                urn: response.data.id || response.headers['x-restli-id'],
                data: response.data
            };
        } catch (error: any) {
            const status = error.response?.status;
            const data = error.response?.data;

            console.error('LinkedIn publishArticlePost Error:', data || error.message);

            // Retryable errors: Rate Limit or Server Errors
            if (status === 429 || (status >= 500 && status <= 599)) {
                throw error; // Throwing allows Inngest to handle retries with backoff
            }

            return {
                success: false,
                error: data || error.message,
                status: status
            };
        }
    }
}

/**
 * Helper to extract YouTube ID from URL
 */
export function extractYoutubeId(url: string): string | null {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

/**
 * Helper to get maxres thumbnail
 */
export function getYoutubeThumbnail(videoId: string): string {
    return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
}
