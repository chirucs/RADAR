from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ConsultRequest(BaseModel):
    scenario: str = Field(..., min_length=3, max_length=4000)


class Recommendation(BaseModel):
    procedure: str
    appropriateness: int
    category: str
    rationale: Optional[str] = None
    rrl: Optional[str] = None
    uses_contrast: Optional[bool] = None
    citation_id: str


class SafetyFlags(BaseModel):
    radiation_concerns: Optional[str] = None
    contrast_concerns: Optional[str] = None


class ConsultResponse(BaseModel):
    topic_match: str
    variant_match: Optional[str] = None
    matched_scenario: Optional[str] = None
    recommendations: List[Recommendation] = Field(default_factory=list)
    safety_flags: SafetyFlags = Field(default_factory=SafetyFlags)
    what_would_change_management: Optional[str] = None
    confidence: str = "low"
    retrieval: List[Dict[str, Any]] = Field(default_factory=list)
    mode: Optional[str] = None
    rejected_recommendations: List[Dict[str, Any]] = Field(default_factory=list)
