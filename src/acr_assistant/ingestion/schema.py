from typing import List, Optional
from pydantic import BaseModel, Field


class Procedure(BaseModel):
    procedure: str
    appropriateness: int = Field(ge=1, le=9)
    category: str
    rrl: str
    uses_contrast: bool = False
    comment: str = ""


class Variant(BaseModel):
    variant_id: str
    scenario: str
    scenario_keywords: List[str] = Field(default_factory=list)
    procedures: List[Procedure]


class Topic(BaseModel):
    topic_id: str
    topic_name: str
    version: str
    citation: str
    keywords: List[str] = Field(default_factory=list)
    variants: List[Variant]


class KnowledgeBase(BaseModel):
    topics: List[Topic]


class Chunk(BaseModel):
    """One retrievable record. Granularity = variant. Each chunk is a self-contained
    citable unit so that retrieval results map 1:1 to recommendations + citations."""
    chunk_id: str
    topic_id: str
    topic_name: str
    variant_id: str
    citation: str
    text: str
    procedures: List[Procedure]
    keywords: List[str]
