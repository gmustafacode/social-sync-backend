import { ChatGroq } from "@langchain/groq";
import { AgentStateType } from "../state";

/**
 * Agent 6: Feedback & Learning
 * Creates a detailed prompt to make the AI smarter for the next run.
 */
export async function learningNode(state: AgentStateType) {
    console.log("[Intelligence-Graph] Starting LEARNING AGENT...");
    const { rawContent, analytics, safetyStatus, topic } = state;

    if (!process.env.GROQ_API_KEY) {
        console.error("[Intelligence-Graph] ERROR: GROQ_API_KEY is missing in Learning Node");
        throw new Error("GROQ_API_KEY is missing");
    }

    const llm = new ChatGroq({
        model: "llama-3.3-70b-versatile",
        temperature: 0.1,
    });

    const prompt = `
    You are a Machine Learning Intelligence Optimizer.
    Analyze this post cycle and provide a specific, actionable rule for future generations.
    
    Topic: ${topic}
    Generated Content: ${rawContent}
    Safety Status: ${JSON.stringify(safetyStatus)}
    Predicted Analytics: ${JSON.stringify(analytics)}
    
    Task: Write a highly detailed instructions for the AI on how to improve.
    Example: "When writing about AI, avoid using 'revolution' and focus more on 'practical automation' as it engages this audience better."
    
    Return the feedback instruction text only.
  `;

    try {
        const response = await llm.invoke([
            ["system", "You are an optimizer. Provide concise rules."],
            ["user", prompt]
        ]);

        const feedbackPrompt = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
        console.log("[Intelligence-Graph] Learning Agent completed.");

        return {
            feedbackPrompt,
            nextAction: "end" as const,
        };
    } catch (error) {
        console.error("[Intelligence-Graph] Learning Agent FAILED:", error);
        throw error;
    }
}
