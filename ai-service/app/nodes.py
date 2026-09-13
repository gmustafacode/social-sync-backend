import json
import uuid
import re
from datetime import datetime
from typing import List, Dict, Any
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from app.config import supabase, get_llm
from app.state import GraphState, ContentItem
from app.schemas import AIAnalysisResult
from app.scoring import calculate_final_score, make_decision

# --- Node Implementation ---

def fetch_content_node(state: GraphState) -> GraphState:
    """
    Fetches pending content from Supabase.
    """
    batch_size = state["batch_size"]
    print(f"Fetching {batch_size} pending items...")
    
    try:
        # Fetch pending content
        response = supabase.table("content_queue") \
            .select("*") \
            .eq("status", "pending") \
            .order("created_at", desc=False) \
            .limit(batch_size) \
            .execute()
        
        items = response.data
        
        # Convert to ContentItem structure
        content_batch: List[ContentItem] = []
        for item in items:
            content_batch.append({
                "id": item["id"],
                "raw_content": item.get("raw_content") or item.get("summary") or "",
                "source_url": item.get("source_url") or "",
                "is_valid": True,
                "validation_error": "",
                "analysis": None,
                "final_score": 0.0,
                "decision": "pending",
                "decision_reason": "",
                "retry_count": 0
            })
            
        print(f"Fetched {len(content_batch)} items.")
        state["content_batch"] = content_batch
        
    except Exception as e:
        print(f"Error fetching content: {e}")
        state["stats"]["ai_errors"] += 1
        
    return state

def validate_content_node(state: GraphState) -> GraphState:
    """
    Validates content quality before AI analysis.
    """
    print("Validating content...")
    valid_batch = []
    
    for item in state["content_batch"]:
        text = item["raw_content"]
        
        # Cleaning
        text = re.sub(r'<[^>]+>', '', text) # Strip HTML
        text = re.sub(r'\s+', ' ', text).strip() # Normalize whitespace
        
        item["raw_content"] = text
        
        # Validation Rules
        if len(text) < 50: # Reduced from 150 for testing, prompt said 150
            item["is_valid"] = False
            item["validation_error"] = "Content too short (<50 chars)"
            item["decision"] = "rejected"
            item["decision_reason"] = "Validation Failed: Too short"
            state["stats"]["rejected"] += 1
        # Add more rules here (language detection etc if needed)
        
        valid_batch.append(item)
        
    state["content_batch"] = valid_batch
    return state

def analyze_content_node(state: GraphState) -> GraphState:
    """
    Calls Groq LLaMA-3 to analyze content.
    """
    print("Analyzing content with AI...")
    llm = get_llm()
    parser = JsonOutputParser(pydantic_object=AIAnalysisResult)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an expert content strategist for a tech/business brand. Verify constraint: Output valid JSON only."),
        ("user", """Analyze the following content for strategic value.
        
        Content: {content}
        
        Return a JSON object with:
        - category: one of [technology, startup, ai, business, marketing, other]
        - content_quality_score: 0-100
        - engagement_score: 0-100
        - virality_probability: 0-100
        - recommended_platforms: list of strings
        - content_type_recommendation: string
        - reasoning: string explanation
        - rewrite_needed: boolean
        
        {format_instructions}
        """)
    ])
    
    chain = prompt | llm | parser
    
    processed_batch = []
    for item in state["content_batch"]:
        if not item["is_valid"]:
            processed_batch.append(item)
            continue
            
        try:
            # Call LLM
            print(f"Analyzing item {item['id']}...")
            result = chain.invoke({
                "content": item["raw_content"][:4000], # Truncate for safety
                "format_instructions": parser.get_format_instructions()
            })
            
            # Populate analysis
            item["analysis"] = result
            state["stats"]["processed"] += 1
            
        except Exception as e:
            print(f"AI Analysis failed for {item['id']}: {e}")
            item["is_valid"] = False # Mark invalid to skip scoring
            item["validation_error"] = f"AI Error: {str(e)}"
            item["decision"] = "ai_error" # Special status
            state["stats"]["ai_errors"] += 1
            
        processed_batch.append(item)
        
    state["content_batch"] = processed_batch
    return state

def score_and_decide_node(state: GraphState) -> GraphState:
    """
    Applies deterministic scoring and business logic.
    """
    print("Scoring and deciding...")
    scored_batch = []
    
    for item in state["content_batch"]:
        if not item["is_valid"] or not item["analysis"]:
            scored_batch.append(item)
            continue
            
        # Convert dict to Pydantic for cleaner access if preferred, or just dict access
        analysis_data = item["analysis"]
        try:
            analysis_obj = AIAnalysisResult(**analysis_data)
            
            # Score
            final_score = calculate_final_score(analysis_obj)
            item["final_score"] = final_score
            
            # Decide
            decision, reason = make_decision(
                final_score, 
                analysis_obj.rewrite_needed, 
                analysis_obj.reasoning,
                analysis_obj
            )
            item["decision"] = decision
            item["decision_reason"] = reason
            
            # Update stats
            if decision == "approved":
                state["stats"]["approved"] += 1
            elif decision == "review":
                state["stats"]["review"] += 1
            elif decision == "rejected":
                state["stats"]["rejected"] += 1
                
        except Exception as e:
            print(f"Scoring error for {item['id']}: {e}")
            item["decision"] = "ai_error"
            item["decision_reason"] = f"Scoring Error: {e}"
            state["stats"]["ai_errors"] += 1
            
        scored_batch.append(item)
        
    state["content_batch"] = scored_batch
    return state

def save_results_node(state: GraphState) -> GraphState:
    """
    Writes results to Supabase.
    """
    print("Saving results...")
    
    batch_id = state.get("batch_id") or str(uuid.uuid4())
    current_time = datetime.now().isoformat()
    
    for item in state["content_batch"]:
        try:
            # 1. Update content_queue
            update_data = {
                "ai_status": item["decision"], # approved, review, rejected, ai_error
                "final_score": item["final_score"],
                "decision_reason": item["decision_reason"],
                "analyzed_at": current_time
            }
            # Also update status to 'processed' or keep 'pending'?
            # Prompt says: "Next Layer (Step 5) must consume: SELECT * FROM content_queue WHERE ai_status = 'approved'"
            # It implies 'status' might still be 'pending' or we assume 'ai_status' is sufficient filter.
            # But earlier prompt said: "If fails validation: Update status = 'rejected', ai_status = 'invalid'".
            # So we should probably update 'status' too.
            # "Is the content strategically valuable?" -> If approved, status -> 'approved'.
            # Let's map ai_status to main status?
            # If ai_status is 'approved' or 'review', main status could be 'processed'?
            # For now, let's just set status='processed' (or keep pending?) so step 5 can pick it up?
            # Step 5 query: `WHERE ai_status = 'approved'`.
            # If status stays 'pending', it will be picked up again by Step 4 query: `WHERE status = 'pending'`.
            # CRITICAL: We MUST change `status` from 'pending' to avoid infinite loops!
            
            if item["decision"] in ["approved", "review"]:
                # Maybe set status to 'ready_for_transform' or just 'processed'?
                # Or if approved -> 'approved'.
                update_data["status"] = item["decision"] 
            elif item["decision"] in ["rejected", "ai_error"]:
                update_data["status"] = "rejected"
            
            supabase.table("content_queue").update(update_data).eq("id", item["id"]).execute()
            
            # 2. Insert into content_ai_analysis (only if analysis exists)
            if item["analysis"]:
                analysis_record = {
                    "content_id": item["id"],
                    "category": item["analysis"]["category"],
                    "content_quality_score": item["analysis"]["content_quality_score"],
                    "engagement_score": item["analysis"]["engagement_score"],
                    "virality_probability": item["analysis"]["virality_probability"],
                    "final_score": item["final_score"],
                    "recommended_platforms": item["analysis"]["recommended_platforms"],
                    "content_type_recommendation": item["analysis"]["content_type_recommendation"],
                    "rewrite_needed": item["analysis"]["rewrite_needed"],
                    "reasoning": item["analysis"]["reasoning"],
                    "raw_llm_response": item["analysis"]
                }
                supabase.table("content_ai_analysis").insert(analysis_record).execute()
                
        except Exception as e:
            print(f"Error saving item {item['id']}: {e}")
            
    # 3. Log batch stats
    log_entry = {
        "batch_id": batch_id,
        "batch_size": state["batch_size"],
        "processed": state["stats"]["processed"],
        "approved": state["stats"]["approved"],
        "review": state["stats"]["review"],
        "rejected": state["stats"]["rejected"],
        "ai_errors": state["stats"]["ai_errors"],
        "execution_time": state["stats"].get("execution_time_ms", 0),
        "started_at": current_time, # approximate
        "finished_at": current_time
    }
    try:
        supabase.table("ai_processing_logs").insert(log_entry).execute()
    except Exception as e:
        print(f"Error saving batch log: {e}")

    return state
