import { ChatGroq } from "@langchain/groq";
import { AgentStateType } from "../state";

/**
 * Agent: Unified Discovery + Research
 *
 * Priority chain:
 *   1. NewsAPI (real trending topics from trusted sources)
 *   2. LLM internal knowledge (fallback if API fails or returns nothing)
 *
 * This SAME node handles both discovery (finding the best topic) AND
 * research (gathering context for the chosen topic). This keeps the
 * pipeline sequential — no two agents can work on the same concern.
 */
export async function searchNode(state: AgentStateType) {
    console.log("[Intelligence-Graph] Starting DISCOVERY + RESEARCH AGENT...");
    const { topic, audience, memory, userId } = state;

    if (!process.env.GROQ_API_KEY) {
        throw new Error("GROQ_API_KEY is missing");
    }

    const llm = new ChatGroq({ model: "llama-3.3-70b-versatile", temperature: 0.2 });

    // ─── STEP A: Topic Discovery via NewsAPI (Priority 1) ────────────────
    let discoveredTopic = topic; // Start with whatever was injected (may be a niche/goal hint)
    let trendContext = "";

    if (process.env.NEWS_API_KEY) {
        try {
            const query = encodeURIComponent(topic.slice(0, 60));
            const newsRes = await fetch(
                `https://newsapi.org/v2/everything?q=${query}&sortBy=popularity&pageSize=5&language=en&apiKey=${process.env.NEWS_API_KEY}`,
                { signal: AbortSignal.timeout(8000) }
            );

            if (newsRes.ok) {
                const newsData = await newsRes.json();
                const articles: any[] = newsData.articles || [];
                const validArticles = articles.filter((a: any) => a.title && a.description);

                if (validArticles.length > 0) {
                    // Build a trending summary from the top articles
                    trendContext = validArticles
                        .slice(0, 3)
                        .map((a: any, i: number) => `${i + 1}. "${a.title}" — ${a.description}`)
                        .join("\n");

                    // Randomly pick one of the top 3 articles to avoid being repetitive
                    const randomIndex = Math.floor(Math.random() * Math.min(validArticles.length, 3));
                    discoveredTopic = validArticles[randomIndex].title;
                    console.log(`[Discovery] NewsAPI found trending topic: "${discoveredTopic}" (index ${randomIndex})`);
                }
            }
        } catch (err) {
            console.warn("[Discovery] NewsAPI fetch failed — falling back to LLM knowledge:", err);
        }
    }

    // ─── STEP B: Research phase — Gather context for the chosen topic ─────
    const memorySection = memory.length > 0
        ? `\nPast Learnings Context:\n${memory.map(m => `• ${m}`).join("\n")}`
        : "";

    const researchPrompt = `You are a highly efficient content research analyst.

Topic to research: "${discoveredTopic}"
Target audience: ${audience || "General public"}
${trendContext ? `\nCurrent trending context:\n${trendContext}` : ""}
${memorySection}

Provide a focused research summary (max 250 words) covering:
1. Why this topic matters right now
2. Key facts, stats, or nuances the audience cares about
3. A unique angle that will help the post stand out
4. One strong opening hook sentence

Do NOT include any meta-commentary like "Here is your research". Just the content.`;

    const response = await llm.invoke([
        ["system", "You are a research assistant. Provide only the requested research."],
        ["user", researchPrompt],
    ]);

    const context = typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);

    console.log(
        `[Intelligence-Graph] Discovery+Research Agent done. Topic: "${discoveredTopic}", Context: ${context.slice(0, 80)}...`
    );

    return {
        topic: discoveredTopic,   // Update state with the discovered topic
        context,
        nextAction: "generate" as const,
    };
}
