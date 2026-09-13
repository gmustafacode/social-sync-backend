from typing import TypedDict, List, Dict, Any, Optional
from app.schemas import ProcessingStats

class ContentItem(TypedDict):
    id: str
    raw_content: str
    source_url: str
    # Processing usage
    is_valid: bool
    validation_error: str
    analysis: Optional[Dict[str, Any]] # AIAnalysisResult dict
    final_score: float
    decision: str # approved, review, rejected
    decision_reason: str
    retry_count: int

class GraphState(TypedDict):
    batch_size: int
    batch_id: str
    content_batch: List[ContentItem]
    stats: Dict[str, Any] # ProcessingStats dict
