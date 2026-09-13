import { StateGraph, END, START } from "@langchain/langgraph";
import { AgentState } from "./state";
import { searchNode } from "./nodes/search";
import { mediaNode } from "./nodes/media";
import { creatorNode } from "./nodes/creator";
import { orchestratorNode } from "./nodes/orchestrator";
import { safetyNode } from "./nodes/safety";
import { analyticsNode } from "./nodes/analytics";
import { learningNode } from "./nodes/learning";

/**
 * Socialyncara Unified Intelligence Pipeline
 *
 * Sequence:
 *   1. research  — Context gathering (topic + audience trend analysis)
 *   2. media     — Media acquisition (conditional on post type)
 *   3. generate  — Human-like content creation
 *   4. orchestrate — Platform-specific tailoring
 *   5. verify    — Safety & compliance check
 *   6. analyze   — Engagement analytics (conditional on safety)
 *   7. learn     — Feedback loop & memory update
 */
const workflow = new StateGraph(AgentState)
    .addNode("research", searchNode)
    .addNode("media", mediaNode)
    .addNode("generate", creatorNode)
    .addNode("orchestrate", orchestratorNode)
    .addNode("verify", safetyNode)
    .addNode("analyze", analyticsNode)
    .addNode("learn", learningNode);

// ── Sequential edges ──────────────────────────────────────────────────────
workflow.addEdge(START, "research");
workflow.addEdge("research", "media");
workflow.addEdge("media", "generate");
workflow.addEdge("generate", "orchestrate");
workflow.addEdge("orchestrate", "verify");

// ── Conditional edge: only proceed to analytics if content is safe ─────────
workflow.addConditionalEdges(
    "verify",
    (state) => state.nextAction === "analyze" ? "analyze" : END
);

workflow.addEdge("analyze", "learn");
workflow.addEdge("learn", END);

export const intelligenceGraph = workflow.compile();
