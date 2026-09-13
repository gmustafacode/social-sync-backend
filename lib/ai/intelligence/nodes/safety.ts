import { ChatGroq } from "@langchain/groq";
import { AgentStateType } from "../state";
import { safeParseJson } from "@/lib/utils/json-parser";

/**
 * Agent 4: Safety & Compliance
 * Ensures our content is safe and professional.
 */
export async function safetyNode(state: AgentStateType) {
    console.log("[Intelligence-Graph] Starting SAFETY AGENT...");
    const { platformContent } = state;

    if (!process.env.GROQ_API_KEY) {
        console.error("[Intelligence-Graph] ERROR: GROQ_API_KEY is missing in Safety Node");
        throw new Error("GROQ_API_KEY is missing");
    }

    const llm = new ChatGroq({
        model: "llama-3.3-70b-versatile",
        temperature: 0.1,
    });

    const contentToVerify = JSON.stringify(platformContent);

    const prompt = `
    You are a Safety Moderator. Check the following social media post package for:
    - Spam or scammy language.
    - Hate speech or toxicity.
    - Restricted keywords.
    
    CONTENT:
    ${contentToVerify}
    
    Return a JSON object:
    { "isSafe": boolean, "flags": ["flag1"], "reason": "why" }
  `;

    try {
        const response = await llm.invoke([
            ["system", "Respond with JSON only."],
            ["user", prompt]
        ]);

        const responseText = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
        const safetyStatus = safeParseJson(responseText, { isSafe: true, flags: [] });
        console.log("[Intelligence-Graph] Safety Agent completed. Status:", safetyStatus.isSafe);

        return {
            safetyStatus,
            nextAction: safetyStatus.isSafe ? "analyze" : "end" as const,
        };
    } catch (error) {
        console.error("[Intelligence-Graph] Safety Agent FAILED:", error);
        throw error;
    }
}
