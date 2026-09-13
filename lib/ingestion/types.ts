
export type ContentSourceType = 'rss' | 'reddit' | 'news_api' | 'unsplash' | 'pexels';
export type RawContentType = 'text' | 'image' | 'video';

export interface NormalizedContent {
    source: ContentSourceType;
    contentType: RawContentType;
    title: string;
    summary?: string;
    rawContent?: string;
    mediaUrl?: string;
    sourceUrl: string;
    author?: string;
    publishedAt?: Date;
    language: string;
    metadata?: any;
}

export interface IngestionResult {
    source: ContentSourceType;
    fetched: number;
    saved: number;
    duplicates: number;
    errors: number;
    executionTime: number;
}
