import { ChatGroq } from "@langchain/groq";
import { AgentStateType } from "../state";

/**
 * Agent: Content Creator
 * Generates a human-like, platform-aware post that matches the user's
 * style preferences (tone, emoji usage, caption length, post type).
 */
export async function creatorNode(state: AgentStateType) {
    console.log("[Intelligence-Graph] Starting CREATOR AGENT...");
    const {
        topic, audience, contentTone, context, memory,
        useEmojis, captionLength, hashtagIntensity, postType, mediaUrls
    } = state;

    if (!process.env.GROQ_API_KEY) {
        throw new Error("GROQ_API_KEY is missing");
    }

    const llm = new ChatGroq({
        model: "llama-3.3-70b-versatile",
        temperature: 0.8, // Higher temp = more creative/natural
    });

    // ─── Build context-aware style instructions ───────────────────────
    const toneMap: Record<string, string> = {
        Formal: "Write in a professional, authoritative tone. No slang.",
        Casual: "Write as if chatting with a friend. Light, breezy, easy to read.",
        Friendly: "Warm, approachable, encouraging. Like a trusted advisor talking.",
        Professional: "Clear, confident, value-driven. No fluff, strong CTA.",
    };
    const toneInstruction = toneMap[contentTone] || toneMap.Professional;

    const captionLengthMap: Record<string, string> = {
        Short: "CRITICAL: The post MUST be brief, strictly under 150 words.",
        Medium: "CRITICAL: The post MUST be exactly 150-280 words medium length.",
        Long: "CRITICAL: The post MUST be a detailed long-form insight taking 280-400 words.",
    };
    const lengthInstruction = captionLengthMap[captionLength] || captionLengthMap.Medium;

    const hashtagMap: Record<string, string> = {
        Low: "CRITICAL: Append EXACTLY 1-2 highly relevant hashtags at the very end of the post.",
        Medium: "CRITICAL: Append EXACTLY 3-5 relevant hashtags at the very end of the post.",
        High: "CRITICAL: Append EXACTLY 6-10 trending hashtags at the very end of the post.",
    };
    const hashtagInstruction = hashtagMap[hashtagIntensity] || hashtagMap.Medium;

    const emojiInstruction = useEmojis
        ? "Naturally sprinkle relevant emojis throughout the post to add personality. Do not overdo it."
        : "Do NOT use any emojis.";

    // ─── Post-type context ─────────────────────────────────────────────
    const postTypeInstruction: Record<string, string> = {
        text_only: "This is a TEXT ONLY post. Write compelling, standalone text with no media reference.",
        image_only: `This post will accompany an IMAGE. Write a short, punchy caption that complements the visual. Image URLs available: ${(mediaUrls || []).join(", ")}`,
        text_image: `This post combines TEXT with an IMAGE. Reference the image naturally in your post. Image: ${(mediaUrls || [])[0] || "provided"}`,
        text_video: `This post accompanies a VIDEO. Create a compelling hook and caption that entices people to watch.`,
        group: "This is a GROUP POST. Write an engaging discussion-starter that prompts community interaction and responses.",
    };
    const postTypeHint = postTypeInstruction[postType] || postTypeInstruction.text_only;

    // ─── Memory & past learnings ───────────────────────────────────────
    const memorySection = memory.length > 0
        ? `\n\n Before generating a post, analyze previously generated content.

Ensure the new post is different in:

• Topic angle  
• Opening hook  
• Structure  
• Examples  
• Insights  
• Scenario  
• Roadmap   

If similarity is detected, deliberately shift to a new perspective, use case, or narrative style.

The goal is continuous originality with consistent brand identity. 
PAST PERFORMANCE LEARNINGS (apply these rules strictly):\n${memory.map(m => `• ${m}`).join("\n")}`
        : "";

    const systemPrompt = `You are an elite social media copywriter who has spent years crafting content that genuinely resonates with real people.

Your writing style is:
- NATURAL and HUMAN — it never sounds AI-generated
- CONVERSATIONAL — reads like a real person talking, not a robot writing
- ENGAGING — creates genuine curiosity or emotion
- ORIGINAL — fresh angles, not clichés or corporate-speak

CRITICAL RULES:
- Never start with "I'm excited to share..." or similar AI openers
- Avoid phrases: "In conclusion", "It's important to note", "In today's digital age", "As an AI"
- Do not mention you are an AI
- Write in first person as the brand/person
- Each post must have a UNIQUE, fresh angle — never repeat the same perspective twice
- Start with a compelling hook that is specifically tailored to the DISCOVERED TOPIC
- Output ONLY the final post text – no meta-commentary, no "Here is your post:"`;

    const userPrompt = `Write a social media post with these specifications:

TOPIC: ${topic}
TARGET AUDIENCE: ${audience || "General public"}
RESEARCH CONTEXT: ${context || "None provided"}${memorySection}

POST TYPE: ${postTypeHint}

STYLE RULES:
- Tone: ${toneInstruction}
- Length: ${lengthInstruction}
- Emojis: ${emojiInstruction}
- Hashtags: ${hashtagInstruction}

OUTPUT: Return only the final post text, ready to publish.`;

    try {
        const response = await llm.invoke([
            ["system", systemPrompt],
            ["user", userPrompt],
        ]);
        const rawContent = typeof response.content === "string"
            ? response.content
            : JSON.stringify(response.content);

        console.log("[Intelligence-Graph] Creator Agent completed.");
        return {
            rawContent,
            nextAction: "orchestrate" as const,
        };
    } catch (error) {
        console.error("[Intelligence-Graph] Creator Agent FAILED:", error);
        throw error;
    }
}
