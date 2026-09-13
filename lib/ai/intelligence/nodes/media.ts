import { AgentStateType } from "../state";

const PEXELS_KEY = process.env.PEXELS_API_KEY;
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;

/**
 * Agent: Media Acquisition
 * Conditionally fetches images or videos based on the user's post type.
 * Only activates when the post type actually requires media.
 */
export async function mediaNode(state: AgentStateType) {
    const { postType, topic } = state;

    // Text-only posts don't need media
    if (postType === "text_only" || !postType) {
        console.log("[Intelligence-Graph] MEDIA AGENT: Skipping (text_only post type).");
        return { mediaUrls: [], nextAction: "generate" as const };
    }

    console.log(`[Intelligence-Graph] MEDIA AGENT: Fetching media for topic="${topic}" type="${postType}"`);

    const needsVideo = postType === "text_video";
    const mediaUrls: string[] = [];

    const query = encodeURIComponent(topic.slice(0, 80));

    try {
        if (needsVideo) {
            // ── Fetch video from Pexels ──────────────────────────────────
            if (PEXELS_KEY) {
                const res = await fetch(
                    `https://api.pexels.com/videos/search?query=${query}&per_page=3`,
                    { headers: { Authorization: PEXELS_KEY } }
                );
                if (res.ok) {
                    const data = await res.json();
                    const videos: any[] = data.videos || [];
                    for (const v of videos.slice(0, 1)) {
                        const file = v.video_files?.find((f: any) => f.quality === "hd") || v.video_files?.[0];
                        if (file?.link) mediaUrls.push(file.link);
                    }
                }
            }
        } else {
            // ── Fetch image from Unsplash (primary) ───────────────────────
            if (UNSPLASH_KEY) {
                const res = await fetch(
                    `https://api.unsplash.com/search/photos?query=${query}&per_page=3&orientation=landscape`,
                    { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } }
                );
                if (res.ok) {
                    const data = await res.json();
                    const photos: any[] = data.results || [];
                    for (const p of photos.slice(0, 2)) {
                        if (p.urls?.regular) mediaUrls.push(p.urls.regular);
                    }
                }
            }

            // ── Fallback: Pexels images ───────────────────────────────────
            if (mediaUrls.length === 0 && PEXELS_KEY) {
                const res = await fetch(
                    `https://api.pexels.com/v1/search?query=${query}&per_page=3`,
                    { headers: { Authorization: PEXELS_KEY } }
                );
                if (res.ok) {
                    const data = await res.json();
                    const photos: any[] = data.photos || [];
                    for (const p of photos.slice(0, 2)) {
                        if (p.src?.large2x) mediaUrls.push(p.src.large2x);
                    }
                }
            }
        }
    } catch (err) {
        console.error("[Intelligence-Graph] MEDIA AGENT: Fetch error:", err);
    }

    console.log(`[Intelligence-Graph] MEDIA AGENT: Found ${mediaUrls.length} media item(s).`);
    return { mediaUrls, nextAction: "generate" as const };
}
