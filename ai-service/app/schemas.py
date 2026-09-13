from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime

class AnalysisRequest(BaseModel):
    batch_size: int = Field(default=10, ge=1, le=50)

class AIAnalysisResult(BaseModel):
    category: Literal["technology", "startup", "ai", "business", "marketing", "other"]
    content_quality_score: int = Field(..., ge=0, le=100)
    engagement_score: int = Field(..., ge=0, le=100)
    virality_probability: int = Field(..., ge=0, le=100)
    recommended_platforms: List[str]
    content_type_recommendation: str
    reasoning: str
    rewrite_needed: bool

class ProcessingStats(BaseModel):
    processed: int = 0
    approved: int = 0
    review: int = 0
    rejected: int = 0
    ai_errors: int = 0
    execution_time_ms: int = 0

class AnalysisResponse(ProcessingStats):
    """
    Response schema for the analysis endpoint, 
    currently matching ProcessingStats.
    """
    pass

class VerificationResult(BaseModel):
    is_valid: bool
    reasons: List[str] = []
