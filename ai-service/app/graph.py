from langgraph.graph import StateGraph, END
from app.state import GraphState
from app.nodes import (
    fetch_content_node,
    validate_content_node,
    analyze_content_node,
    score_and_decide_node,
    save_results_node
)

def create_graph():
    workflow = StateGraph(GraphState)

    # Add nodes
    workflow.add_node("fetch", fetch_content_node)
    workflow.add_node("validate", validate_content_node)
    workflow.add_node("analyze", analyze_content_node)
    workflow.add_node("score", score_and_decide_node)
    workflow.add_node("save", save_results_node)

    # Add edges
    workflow.set_entry_point("fetch")
    
    workflow.add_edge("fetch", "validate")
    workflow.add_edge("validate", "analyze")
    workflow.add_edge("analyze", "score")
    workflow.add_edge("score", "save")
    workflow.add_edge("save", END)

    return workflow.compile()

app_graph = create_graph()
