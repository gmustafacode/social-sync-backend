import { ChatGroq } from "@langchain/groq";
import { AgentStateType } from "../state";
import { safeParseJson } from "@/lib/utils/json-parser";

/**
 * Agent 5: Analytics & Sentiment
 * Estimates how the post will perform.
 */
export async function analyticsNode(state: AgentStateType) {
    console.log("[Intelligence-Graph] Starting ANALYTICS AGENT...");
    const { platformContent, audience } = state;

    if (!process.env.GROQ_API_KEY) {
        console.error("[Intelligence-Graph] ERROR: GROQ_API_KEY is missing in Analytics Node");
        throw new Error("GROQ_API_KEY is missing");
    }

    const llm = new ChatGroq({
        model: "llama-3.3-70b-versatile",
        temperature: 0.1,
    });

    const prompt = `
    You are a Social Media Analyst. Predict the engagement for these posts for the audience: ${audience}.
    
    POSTS:
    ${JSON.stringify(platformContent)}
    
    Return a JSON object with:
    { "engagementEstimate": 0-100, "sentimentEstimate": "positive|neutral|negative" }
  `;

    try {
        const response = await llm.invoke([
            ["system", "Respond with JSON only."],
            ["user", prompt]
        ]);

        const responseText = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
        const analytics = safeParseJson(responseText, { engagementEstimate: 50, sentimentEstimate: "neutral" });
        console.log("[Intelligence-Graph] Analytics Agent completed.");

        return {
            analytics,
            nextAction: "learn" as const,
        };
    } catch (error) {
        console.error("[Intelligence-Graph] Analytics Agent FAILED:", error);
        throw error;
    }
}
