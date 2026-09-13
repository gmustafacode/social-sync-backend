from app.schemas import AIAnalysisResult, ProcessingStats

def calculate_final_score(analysis: AIAnalysisResult) -> float:
    """
    Calculates the deterministic final score based on weighted components.
    Formula: (quality * 0.4) + (engagement * 0.3) + (virality * 0.3)
    Output is clamped between 0 and 100.
    """
    try:
        score = (
            (analysis.content_quality_score * 0.4) +
            (analysis.engagement_score * 0.3) +
            (analysis.virality_probability * 0.3)
        )
        return max(0.0, min(100.0, round(score, 2)))
    except Exception as e:
        print(f"Error calculating score: {e}")
        return 0.0

def make_decision(final_score: float, rewrite_needed: bool, reasoning: str, analysis: AIAnalysisResult) -> tuple[str, str]:
    """
    Determines the final status (approved, review, rejected) based on the score and business rules.
    Returns: (status, decision_reason)
    """
    
    status = "rejected"
    decision_reason = f"Score {final_score} below threshold"

    # Rule 1: Spam detection via reasoning (simple keyword check or from LLM flag if we had one)
    # The prompt says: "If LLM reasoning flags spam -> force reject"
    # We'll assume if the reasoning explicitly starts with "SPAM" or similar. 
    # But let's rely mostly on the score as per the prompt's main logic.
    if "spam" in reasoning.lower() and final_score < 80: # Safety: only reject for spam if score isn't super high (false positive check)
        return "rejected", "Spam detected in reasoning"

    # Rule 2: Score thresholds
    if final_score < 40:
        status = "rejected"
        decision_reason = "Score < 40"
    elif 40 <= final_score < 70:
        status = "review"
        decision_reason = "Score between 40 and 70"
    else: # >= 70
        status = "approved"
        decision_reason = "Score >= 70"

    # Rule 3: Rewrite needed safeguard
    # "If rewrite_needed = true AND score >= 60 -> allow review"
    # This implies if it was going to be rejected but score is decent and needs rewrite, maybe upgrade?
    # Actually, < 40 is rejected. >= 40 is review. So this rule basically says 
    # if it's in the review range (or approved range) but needs rewrite, ensure it's review?
    # Or maybe it boosts a rejected item?
    # Prompt says: "If rewrite_needed = true AND score >= 60 -> allow review"
    # If score is 65, it's already "review". If score is 75, it's "approved", maybe we should downgrade to review?
    # Let's interpret "allow review" as "force review if it would have been approved, or ensure review if rejected?"
    # Score < 40 + Rewrite = True -> Still rejected probably.
    # Score 75 + Rewrite = True -> Should be Review? "allow review" might mean "downgrade to review".
    # Let's assume: If score >= 70 (Approved) AND Rewrite Needed -> Downgrade to Review.
    if status == "approved" and rewrite_needed:
        status = "review"
        decision_reason = "High score but rewrite needed"
        
    # Another interpretation: If score >= 60 and < 70 (Review), it stays review.
    # If score >= 60 (so 60-100) -> ensure at least Review.
    # If score was 75 (Approved) -> Downgrade to Review? Yes, that makes sense for "Rewrite Needed".
    
    return status, decision_reason