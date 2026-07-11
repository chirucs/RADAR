from pathlib import Path
from typing import Any, Dict, List, Optional

from .config import Settings, get_settings
from .generation.llm import generate_consult
from .ingestion.parser import kb_to_chunks, load_kb
from .retrieval.retriever import BM25Retriever, RetrievalResult, build_index, load_index, save_index


class ConsultPipeline:
    """End-to-end orchestration: retrieve → generate → validate citations."""

    def __init__(self, retriever: BM25Retriever, settings: Settings):
        self.retriever = retriever
        self.settings = settings
        self._valid_chunk_ids = {c.chunk_id for c in retriever.chunks}

    @classmethod
    def from_settings(cls, settings: Optional[Settings] = None) -> "ConsultPipeline":
        settings = settings or get_settings()
        index_path = settings.index_abs()
        if index_path.exists():
            retriever = load_index(index_path)
        else:
            kb = load_kb(settings.kb_abs())
            retriever = build_index(kb_to_chunks(kb))
            save_index(retriever, index_path)
        return cls(retriever, settings)

    def run(self, scenario: str) -> Dict[str, Any]:
        retrieved: List[RetrievalResult] = self.retriever.retrieve(
            scenario,
            top_k=self.settings.retrieval_top_k,
            confidence_threshold=self.settings.confidence_threshold,
        )
        result = generate_consult(
            scenario=scenario,
            retrieved=retrieved,
            api_key=self.settings.anthropic_api_key,
            model=self.settings.llm_model,
            max_tokens=self.settings.max_tokens,
        )
        result = self._validate_citations(result)
        result["_retrieval"] = [
            {
                "chunk_id": r.chunk.chunk_id,
                "topic_id": r.chunk.topic_id,
                "variant_id": r.chunk.variant_id,
                "score": round(r.score, 4),
                "normalized_score": round(r.normalized_score, 4),
            }
            for r in retrieved
        ]
        return result

    def _validate_citations(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Strip any recommendation whose citation_id doesn't match a real retrieved chunk.
        This is the post-generation guardrail against hallucinated citations."""
        recs = result.get("recommendations") or []
        kept = []
        rejected = []
        for r in recs:
            cid = r.get("citation_id")
            if cid in self._valid_chunk_ids:
                kept.append(r)
            else:
                rejected.append({"procedure": r.get("procedure"), "bad_citation_id": cid})
        result["recommendations"] = kept
        if rejected:
            result["_rejected_recommendations"] = rejected
        return result
