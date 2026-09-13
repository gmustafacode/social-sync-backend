import { ChatGroq } from "@langchain/groq";
import { AgentStateType } from "../state";
import { safeParseJson } from "@/lib/utils/json-parser";

/**
 * Orchestrator Agent — Platform Tailoring
 * Takes the raw post and adapts it to each of the user's enabled platforms,
 * respecting platform character limits and per-platform content preferences.
 */
export async function orchestratorNode(state: AgentStateType) {
  console.log("[Intelligence-Graph] Starting ORCHESTRATOR AGENT...");
  const { rawContent, preferredPlatforms, platformPreferences, hashtagIntensity, captionLength } = state;

  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is missing");
  }

  // Only target platforms the user has enabled
  const activePlatforms = (preferredPlatforms?.length ? preferredPlatforms : ["linkedin"])
    .filter(p => {
      const pPref = platformPreferences?.[p];
      // If no preference object exists, default to enabled
      return pPref === undefined || pPref?.enabled !== false;
    });

  if (activePlatforms.length === 0) {
    console.warn("[Intelligence-Graph] No active platforms — defaulting to linkedin.");
    activePlatforms.push("linkedin");
  }

  const hashtagCountMap: Record<string, string> = {
    Low: "1-2",
    Medium: "3-5",
    High: "6-10",
  };
  const hashtagCount = hashtagCountMap[hashtagIntensity] || "3-5";

  const llm = new ChatGroq({ model: "llama-3.3-70b-versatile", temperature: 0.2 });

  const lengthPreservation = captionLength === "Long" || captionLength === "Medium"
    ? `\nCRITICAL LENGTH REQUIREMENT: The user requested a ${captionLength} post. DO NOT summarize or shorten the RAW POST unless it strictly violates the platform's hard character limit.`
    : "";

  const prompt = `You are a Social Media Platform Specialist.
Adapt the following post for each of these platforms: ${activePlatforms.join(", ")}.

RAW POST:
${rawContent}
${lengthPreservation}

PLATFORM RULES:
- linkedin: Max 2950 chars (including hashtags). Professional. Must include ${hashtagCount} hashtags explicitly appended to the text. mediaRules: "Professional image or article link".
- instagram: Max 2200 chars. Visual-first. Must include ${hashtagCount} hashtags explicitly appended to the text. mediaRules: "High-quality image or Reel".
- tiktok: Max 150 chars for caption. Must include ${hashtagCount} hashtags explicitly appended to the text. mediaRules: "Short vertical video". 
- facebook: Max 63206 chars. Conversational. Must include ${hashtagCount} hashtags explicitly appended to the text. mediaRules: "Image or video".
- telegram: No strict limit. Informational. Optional hashtags append to text. mediaRules: "Image or document".
- twitter: Max 280 chars. Punchy. 1-2 hashtags explicitly appended to the text. mediaRules: "Image or GIF".

Only return a JSON object for the active platforms listed. 
CRITICAL: The "text" field MUST contain the full final post content AND the hashtags appended at the very end. Do NOT create a separate "hashtags" array.

Format:
{
  "platform_name": { "text": "... [content] ... #tag1 #tag2", "mediaRules": "..." }
}

IMPORTANT: Return valid JSON only. No explanations.`;

  const response = await llm.invoke([
    ["system", "Respond with JSON only."],
    ["user", prompt],
  ]);

  const contentText = typeof response.content === "string"
    ? response.content
    : JSON.stringify(response.content);
  const platformContent = safeParseJson(contentText, {});

  return {
    platformContent,
    nextAction: "verify" as const,
  };
}
