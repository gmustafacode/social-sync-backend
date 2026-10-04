const STOP_WORDS = new Set([
    "about", "after", "also", "from", "into", "most", "that", "their", "the", "this", "with", "your"
]);

const unique = (items) => [...new Set(items.filter(Boolean))];

export const extractHashtags = (text = "") => unique(
    [...text.matchAll(/#[a-z0-9_]+/gi)].map(([tag]) => tag.toLowerCase())
);

export const hashtagsForTopic = (topic = "") => unique(
    topic
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 3 && !STOP_WORDS.has(word))
        .slice(0, 4)
        .map((word) => `#${word}`)
);

export const buildPostMetadata = ({ content = "", topic = "", platform = "linkedin", metadata = {} }) => {
    if (typeof metadata === "string") {
        try { metadata = JSON.parse(metadata); } catch { metadata = {}; }
    }
    const hashtags = unique([
        ...(Array.isArray(metadata.hashtags) ? metadata.hashtags : []),
        ...extractHashtags(content),
        ...hashtagsForTopic(topic)
    ]).slice(0, platform === "instagram" ? 10 : 5);
    const cleanContent = content.replace(/#[a-z0-9_]+/gi, "").replace(/\s+/g, " ").trim();
    const title = metadata.seoTitle || cleanContent.split(/[.!?]\s/)[0] || topic;

    return {
        hashtags,
        keywords: unique([
            ...(Array.isArray(metadata.keywords) ? metadata.keywords : []),
            ...hashtags.map((tag) => tag.slice(1))
        ]).slice(0, 10),
        seoTitle: title.slice(0, 60),
        seoDescription: (metadata.seoDescription || cleanContent || topic).slice(0, 160),
        altText: metadata.altText || `Visual content about ${topic || title}`,
        platform
    };
};

export const contentWithHashtags = (content = "", metadata = {}) => {
    const existing = extractHashtags(content);
    const missing = (metadata.hashtags || []).filter((tag) => !existing.includes(tag.toLowerCase()));
    return missing.length ? `${content.trim()}\n\n${missing.join(" ")}` : content.trim();
};